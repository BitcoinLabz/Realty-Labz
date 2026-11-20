"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ownerOnlyFilter } from "@/lib/authorization";
import { readDocumentFile } from "@/lib/document-storage";
import { applyOfficeChecklist } from "@/lib/office-checklist";
import { userIsPro } from "@/lib/user-plan";
import {
  analyzeContractPdf,
  ContractAnalysisError,
  isAiConfigured,
  type ExtractedContractData,
} from "@/lib/ai-contract-analysis";
import type { FormState } from "@/app/actions/auth";
import { parseAnchorDateUtc } from "@/lib/deadline-templates";
import { recalculateDealDeadlines } from "@/lib/deal-deadline-recalc";

const CATEGORIES = [
  "INSPECTION",
  "FINANCING",
  "APPRAISAL",
  "TITLE",
  "SALE_OF_BUYERS_HOME",
  "DUE_DILIGENCE",
  "EARNEST_MONEY",
  "CLOSING",
  "OTHER",
] as const;
type Category = (typeof CATEGORIES)[number];

type ReviewedDeadline = {
  index: number;
  checked: boolean;
  label: string;
  dueDate: string | null;
  rule: { baseEvent: "ACCEPTANCE" | "CLOSING" | "DEADLINE"; baseIndex: number | null; offsetDays: number; dayType: "CALENDAR" | "BUSINESS" } | null;
  category: Category | null;
  amount: number | null;
  sourceQuote: string | null;
  clientNote: string | null;
  existingId: string | null;
};

type ReviewedOption = {
  label: string;
  days: number;
  dayType: "CALENDAR" | "BUSINESS";
  additionalDeposit: number | null;
  cost: number | null;
  exercisableBy: string | null;
  noticeText: string | null;
  noticeDate: string | null;
  targetIndexes: number[];
  sourceQuote: string | null;
};

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
const money = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : null);

// Everything below arrives from the browser as JSON: each field is checked
// and capped so a tampered request can't write junk. Text shown to clients
// is escaped where it's emailed (see escapeHtml in src/lib/email.ts).
function parseReviewedDeadlines(raw: FormDataEntryValue | null): ReviewedDeadline[] | null {
  if (typeof raw !== "string" || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 200) return null;
  const out: ReviewedDeadline[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const label = optionalText(d.label, 200);
    const index = int(d.index, 0, 199);
    if (!label || index === null) continue;
    const r = d.rule as Record<string, unknown> | null | undefined;
    const rule =
      r && typeof r === "object" && ["ACCEPTANCE", "CLOSING", "DEADLINE"].includes(r.baseEvent as string)
        ? {
            baseEvent: r.baseEvent as "ACCEPTANCE" | "CLOSING" | "DEADLINE",
            baseIndex: int(r.baseIndex, 0, 199),
            offsetDays: int(r.offsetDays, -3650, 3650) ?? 0,
            dayType: (r.dayType === "BUSINESS" ? "BUSINESS" : "CALENDAR") as "CALENDAR" | "BUSINESS",
          }
        : null;
    out.push({
      index,
      checked: d.checked === true,
      label,
      dueDate: typeof d.dueDate === "string" ? d.dueDate : null,
      rule: rule && (rule.baseEvent !== "DEADLINE" || rule.baseIndex !== null) ? rule : null,
      category: CATEGORIES.includes(d.category as Category) ? (d.category as Category) : null,
      amount: money(d.amount),
      sourceQuote: optionalText(d.sourceQuote, 500),
      clientNote: optionalText(d.clientNote, 300),
      existingId: typeof d.existingId === "string" && d.existingId ? d.existingId : null,
    });
  }
  return out;
}

function parseReviewedOptions(raw: FormDataEntryValue | null): ReviewedOption[] | null {
  if (typeof raw !== "string" || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 20) return null;
  const out: ReviewedOption[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = optionalText(o.label, 200);
    const days = int(o.days, 1, 3650);
    if (!label || days === null) continue;
    out.push({
      label,
      days,
      dayType: o.dayType === "BUSINESS" ? "BUSINESS" : "CALENDAR",
      additionalDeposit: money(o.additionalDeposit),
      cost: money(o.cost),
      exercisableBy: optionalText(o.exercisableBy, 60),
      noticeText: optionalText(o.noticeText, 300),
      noticeDate: typeof o.noticeDate === "string" ? o.noticeDate : null,
      targetIndexes: Array.isArray(o.targetIndexes)
        ? o.targetIndexes.map((i) => int(i, 0, 199)).filter((i): i is number => i !== null)
        : [],
      sourceQuote: optionalText(o.sourceQuote, 500),
    });
  }
  return out;
}

export type AnalysisState = FormState & {
  extracted?: ExtractedContractData;
};

// Reads an uploaded contract PDF and returns what the model found -- this
// action deliberately writes NOTHING to the database. The agent reviews and
// edits the result first, then applyContractAnalysisAction below saves only
// what they confirmed. Same human-in-the-loop principle the Forms auto-fill
// already follows (a bound field is pre-filled but always stays editable).
export async function analyzeContractAction(
  _prevState: AnalysisState,
  formData: FormData,
): Promise<AnalysisState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!isAiConfigured()) {
    console.error("[contract-reading] refused a read because ANTHROPIC_API_KEY is not set");
    return { error: "Contract reading isn't available right now. You can add the deadlines by hand." };
  }
  // Each read costs real money (Anthropic API), so it's a Pro feature.
  if (!(await userIsPro(session.user.id))) {
    return {
      error:
        "Contract reading is part of Pro: each read uses a paid AI service. Upgrade in Settings → Plan, or add the deadlines by hand for free.",
    };
  }

  const documentId = formData.get("documentId");
  const dealId = formData.get("dealId");
  if (typeof documentId !== "string" || !documentId) return { error: "Missing document" };
  if (typeof dealId !== "string" || !dealId) return { error: "Missing deal" };

  // Scoped by both id AND dealId -- id alone would let a user who can see ANY
  // deal analyze a document belonging to a different tenant, since a
  // Document id carries no ownership information of its own. Same compound
  // -where guard as deal-deadlines.ts.
  const deal = await prisma.deal.findFirst({ where: { id: dealId, ...ownerOnlyFilter(session.user) } });
  if (!deal) return { error: "Deal not found" };

  const document = await prisma.document.findFirst({ where: { id: documentId, dealId } });
  if (!document) return { error: "Document not found" };
  if (document.mimeType !== "application/pdf") {
    return { error: "Only PDF contracts can be analyzed" };
  }

  try {
    const pdfBuffer = await readDocumentFile(document.storageKey);
    const extracted = await analyzeContractPdf(pdfBuffer);
    return { extracted };
  } catch (err) {
    // Surfaced, not swallowed -- an invisible no-op here would look exactly
    // like "the button does nothing" (the same failure mode already fixed
    // once on the asset-refresh buttons).
    console.error("[contract-analysis] analyze failed", { documentId, err });
    const message =
      err instanceof ContractAnalysisError ? err.message : "Couldn't analyze this document right now";
    return { error: message };
  }
}

// Trimmed text or null, cut to a maximum length.
function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// Writes only what the agent actually confirmed in the review panel. Fields
// arrive as plain form values (blank = don't change), and deadlines arrive as
// one JSON blob from the checkbox list -- the same hidden-JSON-input pattern
// saveFormFieldsAction already established for the field designer.
// What a save did, so the Contract assistant can say it plainly and offer
// the obvious next step (add to calendar, add the client's email).
export type ApplyResult = {
  added: number;
  updated: number;
  options: number;
  client: { id: string; name: string; hasEmail: boolean; remindersOn: boolean } | null;
};
export type ApplyState = FormState & { result?: ApplyResult };

export async function applyContractAnalysisAction(
  _prevState: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return { error: "Missing deal" };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, ...ownerOnlyFilter(session.user) } });
  if (!deal) return { error: "Deal not found" };

  const propertyAddress = formData.get("propertyAddress");
  const salePrice = formData.get("salePrice");
  const closingDate = formData.get("closingDate");

  const dealUpdates: {
    propertyAddress?: string;
    salePrice?: number;
    closingDate?: Date;
    acceptanceDate?: Date;
    status?: "UNDER_CONTRACT";
  } = {};
  // Offered only while the deal is still Active: a signed contract is what
  // moves it to Under contract, and saying so here saves a trip to Overview.
  if (formData.get("markUnderContract") === "on" && deal.status === "ACTIVE") {
    dealUpdates.status = "UNDER_CONTRACT";
  }
  if (typeof propertyAddress === "string" && propertyAddress.trim()) {
    dealUpdates.propertyAddress = propertyAddress.trim();
  }
  if (typeof salePrice === "string" && salePrice.trim() && !Number.isNaN(Number(salePrice))) {
    dealUpdates.salePrice = Number(salePrice);
  }
  if (typeof closingDate === "string" && closingDate.trim()) {
    const parsed = parseAnchorDateUtc(closingDate);
    if (parsed) dealUpdates.closingDate = parsed;
  }

  const parsedDeadlines = parseReviewedDeadlines(formData.get("deadlines"));
  if (!parsedDeadlines) return { error: "Malformed deadline data" };
  const parsedOptions = parseReviewedOptions(formData.get("options"));
  if (!parsedOptions) return { error: "Malformed extension data" };

  const acceptanceDate = formData.get("acceptanceDate");
  if (typeof acceptanceDate === "string" && acceptanceDate.trim()) {
    const parsed = parseAnchorDateUtc(acceptanceDate);
    if (parsed) dealUpdates.acceptanceDate = parsed;
  }

  if (Object.keys(dealUpdates).length > 0) {
    await prisma.deal.updateMany({
      where: { id: dealId, ...ownerOnlyFilter(session.user) },
      data: dealUpdates,
    });
  }
  // "Mark as Under contract" hands the file to the office (see
  // applyOfficeChecklist -- a no-op unless it just went under contract).
  await applyOfficeChecklist(dealId, session.user.id);

  // Pass 1: create or update every ticked row, remembering which saved id
  // each review index became. A matched row from an amended contract keeps
  // its existing id (only ever used together with dealId, so a forged id
  // from another deal is inert).
  const idByIndex = new Map<number, string>();
  let added = 0;
  let updated = 0;
  for (const d of parsedDeadlines) {
    if (!d.checked) {
      if (d.existingId) idByIndex.set(d.index, d.existingId); // still a valid base to count from
      continue;
    }
    const due = d.dueDate ? parseAnchorDateUtc(d.dueDate) : null;
    if (!due) continue;
    const data = {
      label: d.label,
      dueDate: due,
      sourceQuote: d.sourceQuote,
      clientNote: d.clientNote,
      category: d.category,
      amount: d.amount,
      baseEvent: d.rule?.baseEvent ?? null,
      offsetDays: d.rule?.offsetDays ?? null,
      dayType: d.rule?.dayType ?? "CALENDAR",
      baseDeadlineId: null,
    } as const;
    if (d.existingId) {
      // Clearing the reminder stamps means the client hears about the NEW date.
      const res = await prisma.dealDeadline.updateMany({
        where: { id: d.existingId, dealId, completedAt: null },
        data: { ...data, extensionDays: 0, autoReminderEarlySentAt: null, autoReminderFinalSentAt: null },
      });
      if (res.count === 1) {
        idByIndex.set(d.index, d.existingId);
        updated++;
      }
    } else {
      const created = await prisma.dealDeadline.create({ data: { ...data, dealId }, select: { id: true } });
      idByIndex.set(d.index, created.id);
      added++;
    }
  }

  // Pass 2: link "counted from another deadline" rules now that every row
  // has an id. If the base wasn't saved, the deadline keeps its date as a
  // fixed one rather than pointing at nothing.
  for (const d of parsedDeadlines) {
    if (!d.checked || d.rule?.baseEvent !== "DEADLINE") continue;
    const id = idByIndex.get(d.index);
    if (!id) continue;
    const baseId = d.rule.baseIndex != null ? idByIndex.get(d.rule.baseIndex) : undefined;
    await prisma.dealDeadline.updateMany({
      where: { id, dealId },
      data: baseId ? { baseDeadlineId: baseId } : { baseEvent: null, offsetDays: null },
    });
  }

  // Extension options become one-tap buttons on the transaction.
  if (parsedOptions.length > 0) {
    await prisma.dealExtensionOption.createMany({
      data: parsedOptions.map((o) => ({
        dealId,
        label: o.label,
        days: o.days,
        dayType: o.dayType,
        additionalDeposit: o.additionalDeposit,
        cost: o.cost,
        exercisableBy: o.exercisableBy,
        noticeText: o.noticeText,
        noticeDate: o.noticeDate ? parseAnchorDateUtc(o.noticeDate) : null,
        targetDeadlineIds: o.targetIndexes.map((i) => idByIndex.get(i)).filter((id): id is string => !!id),
        sourceQuote: o.sourceQuote,
      })),
    });
  }

  // The app's own arithmetic has the last word on every rule date.
  await recalculateDealDeadlines(dealId);

  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  const client = deal.clientId
    ? await prisma.client.findFirst({
        where: { id: deal.clientId, userId: deal.userId },
        select: { id: true, name: true, email: true, emailDeadlineReminders: true },
      })
    : null;

  return {
    result: {
      added,
      updated,
      options: parsedOptions.length,
      client: client
        ? {
            id: client.id,
            name: client.name,
            hasEmail: !!client.email,
            remindersOn: client.emailDeadlineReminders,
          }
        : null,
    },
  };
}
