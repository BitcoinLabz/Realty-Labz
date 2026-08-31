"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ownerOnlyFilter } from "@/lib/authorization";
import { readDocumentFile } from "@/lib/document-storage";
import {
  analyzeContractPdf,
  ContractAnalysisError,
  isAiConfigured,
  type ExtractedContractData,
} from "@/lib/ai-contract-analysis";
import type { FormState } from "@/app/actions/auth";

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
  if (!isAiConfigured()) return { error: "AI analysis isn't set up yet" };

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

// Writes only what the agent actually confirmed in the review panel. Fields
// arrive as plain form values (blank = don't change), and deadlines arrive as
// one JSON blob from the checkbox list -- the same hidden-JSON-input pattern
// saveFormFieldsAction already established for the field designer.
export async function applyContractAnalysisAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
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
  } = {};
  if (typeof propertyAddress === "string" && propertyAddress.trim()) {
    dealUpdates.propertyAddress = propertyAddress.trim();
  }
  if (typeof salePrice === "string" && salePrice.trim() && !Number.isNaN(Number(salePrice))) {
    dealUpdates.salePrice = Number(salePrice);
  }
  if (typeof closingDate === "string" && closingDate.trim()) {
    const parsed = new Date(closingDate);
    if (!Number.isNaN(parsed.getTime())) dealUpdates.closingDate = parsed;
  }

  const deadlinesJson = formData.get("deadlines");
  let deadlines: { label: string; dueDate: string }[] = [];
  if (typeof deadlinesJson === "string" && deadlinesJson) {
    try {
      const parsed: unknown = JSON.parse(deadlinesJson);
      if (!Array.isArray(parsed)) return { error: "Malformed deadline data" };
      deadlines = parsed.filter(
        (d): d is { label: string; dueDate: string } =>
          !!d &&
          typeof d === "object" &&
          typeof (d as { label?: unknown }).label === "string" &&
          typeof (d as { dueDate?: unknown }).dueDate === "string" &&
          !Number.isNaN(new Date((d as { dueDate: string }).dueDate).getTime()),
      );
    } catch {
      return { error: "Malformed deadline data" };
    }
  }

  if (Object.keys(dealUpdates).length > 0) {
    await prisma.deal.updateMany({
      where: { id: dealId, ...ownerOnlyFilter(session.user) },
      data: dealUpdates,
    });
  }

  if (deadlines.length > 0) {
    await prisma.dealDeadline.createMany({
      data: deadlines.map((d) => ({ dealId, label: d.label, dueDate: new Date(d.dueDate) })),
    });
  }

  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/dashboard");
  return {};
}
