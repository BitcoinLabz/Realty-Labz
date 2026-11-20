// Turns what the contract reader found into the review screen's rows
// (2026-11-19), and checks it -- in plain code, not by trusting the model:
//
// - Every deadline that has a rule gets its date recomputed from the rule
//   (src/lib/deadline-rules.ts). If the reader's own arithmetic disagrees,
//   the row is flagged so the agent looks before saving.
// - "Missed-data warnings": any extension, deposit or contingency the reader
//   mentioned but didn't turn into a deadline or option is listed, as is an
//   option that points at no deadline, a deposit with no amount, and so on.
//
// Pure and prisma-free (imported by the review screen, a client component);
// tested in contract-review.test.ts against sample contracts.

import type { ExtractedContractData } from "@/lib/ai-contract-analysis";
import { parseAnchorDateUtc, formatDeadlineDate } from "@/lib/deadline-templates";
import { computeDeadlineDates, type BaseEvent, type DayType, type RuleDeadline } from "@/lib/deadline-rules";

export type Confidence = "high" | "medium" | "low";

export type ReviewRule = {
  baseEvent: BaseEvent;
  /** For DEADLINE: index of the base deadline in the review list. */
  baseIndex: number | null;
  offsetDays: number;
  dayType: DayType;
};

export type ReviewItem = {
  label: string;
  category: ExtractedContractData["deadlines"][number]["category"];
  rule: ReviewRule | null;
  /** The reader's date, as given. */
  readerDate: string | null;
  /** The date the app works out from the rule (null with no rule or no base date). */
  ruleDate: string | null;
  /** What will be saved: the rule's date when there is one, else the reader's. */
  dueDate: string | null;
  dateMismatch: boolean;
  amount: number | null;
  confidence: Confidence;
  ambiguity: string | null;
  sourceQuote: string | null;
  page: number | null;
  basis: string | null;
  clientNote: string;
};

export type ReviewOption = {
  label: string;
  days: number;
  dayType: DayType;
  additionalDeposit: number | null;
  cost: number | null;
  exercisableBy: string | null;
  noticeText: string | null;
  noticeDate: string | null;
  /** Indexes into the review items. */
  targetIndexes: number[];
  sourceQuote: string | null;
  page: number | null;
  confidence: Confidence;
};

export type ReviewWarning = { kind: "missed" | "unlinked" | "incomplete"; text: string; quote?: string | null };

export type ContractReview = {
  acceptanceDate: string | null;
  closingDate: string | null;
  items: ReviewItem[];
  options: ReviewOption[];
  warnings: ReviewWarning[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function findLabel(labels: string[], wanted: string | null | undefined): number | null {
  if (!wanted) return null;
  const w = norm(wanted);
  const exact = labels.findIndex((l) => norm(l) === w);
  if (exact >= 0) return exact;
  // The model sometimes shortens or extends a label slightly.
  const loose = labels.findIndex((l) => norm(l).includes(w) || w.includes(norm(l)));
  return loose >= 0 ? loose : null;
}

/** Recomputes every rule date from the acceptance/closing dates given. */
export function computeReviewDates(
  items: Pick<ReviewItem, "label" | "rule" | "readerDate" | "category">[],
  acceptanceDate: string | null,
  closingDate: string | null,
): (string | null)[] {
  const fallback = new Date(Date.UTC(1970, 0, 1));
  const asRule: RuleDeadline[] = items.map((item, i) => ({
    id: String(i),
    label: item.label,
    rule: item.rule
      ? {
          baseEvent: item.rule.baseEvent,
          baseDeadlineId: item.rule.baseIndex == null ? null : String(item.rule.baseIndex),
          offsetDays: item.rule.offsetDays,
          dayType: item.rule.dayType,
        }
      : null,
    dueDate: (item.readerDate && parseAnchorDateUtc(item.readerDate)) || fallback,
    extensionDays: 0,
    isClosing: item.category === "CLOSING",
  }));
  const dates = computeDeadlineDates(asRule, {
    acceptanceDate: acceptanceDate ? parseAnchorDateUtc(acceptanceDate) : null,
    closingDate: closingDate ? parseAnchorDateUtc(closingDate) : null,
  });
  return items.map((item, i) => {
    if (!item.rule) return null;
    const date = dates.get(String(i))!;
    return date.getTime() === fallback.getTime() ? null : formatDeadlineDate(date);
  });
}

export function buildContractReview(x: ExtractedContractData): ContractReview {
  const labels = x.deadlines.map((d) => d.label);

  const items: ReviewItem[] = x.deadlines.map((d) => {
    const baseIndex = d.baseEvent === "OTHER_DEADLINE" ? findLabel(labels, d.baseDeadlineLabel) : null;
    const hasRule =
      d.baseEvent !== "FIXED_DATE" && d.offsetDays != null && (d.baseEvent !== "OTHER_DEADLINE" || baseIndex != null);
    return {
      label: d.label,
      category: d.category,
      rule: hasRule
        ? {
            baseEvent: d.baseEvent === "OTHER_DEADLINE" ? "DEADLINE" : (d.baseEvent as "ACCEPTANCE" | "CLOSING"),
            baseIndex,
            offsetDays: d.offsetDays!,
            dayType: d.dayType,
          }
        : null,
      readerDate: d.dueDate,
      ruleDate: null,
      dueDate: d.dueDate,
      dateMismatch: false,
      amount: d.amount,
      confidence: d.confidence,
      ambiguity: d.ambiguity,
      sourceQuote: d.sourceQuote,
      page: d.page,
      basis: d.basis,
      clientNote: d.clientExplanation,
    };
  });

  const ruleDates = computeReviewDates(items, x.acceptanceDate, x.closingDate);
  items.forEach((item, i) => {
    item.ruleDate = ruleDates[i];
    if (item.ruleDate) {
      item.dateMismatch = !!item.readerDate && item.readerDate !== item.ruleDate;
      item.dueDate = item.ruleDate;
    }
  });

  const options: ReviewOption[] = x.extensionOptions.map((o) => ({
    label: o.label,
    days: o.days,
    dayType: o.dayType,
    additionalDeposit: o.additionalDeposit,
    cost: o.cost,
    exercisableBy: o.exercisableBy,
    noticeText: o.noticeText,
    noticeDate: o.noticeDate,
    targetIndexes: o.affectedDeadlineLabels
      .map((l) => findLabel(labels, l))
      .filter((i): i is number => i !== null),
    sourceQuote: o.sourceQuote,
    page: o.page,
    confidence: o.confidence,
  }));

  return {
    acceptanceDate: x.acceptanceDate,
    closingDate: x.closingDate,
    items,
    options,
    warnings: contractWarnings(x, items, options),
  };
}

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function contractWarnings(x: ExtractedContractData, items: ReviewItem[], options: ReviewOption[]): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];
  const captured = [...items.map((i) => i.label), ...options.map((o) => o.label)];

  for (const m of x.mentions) {
    if (m.capturedAs && findLabel(captured, m.capturedAs) !== null) continue;
    const what = { EXTENSION: "an extension", DEPOSIT: "a deposit", CONTINGENCY: "a contingency", OTHER_DATE: "a date" }[m.topic];
    warnings.push({
      kind: "missed",
      text: `The contract mentions ${what} that wasn't turned into a deadline: ${m.summary}`,
      quote: m.sourceQuote,
    });
  }

  x.extensionOptions.forEach((o, i) => {
    if (options[i].targetIndexes.length === 0) {
      warnings.push({
        kind: "unlinked",
        text: `"${o.label}" doesn't point at any deadline here, so using it wouldn't move anything. Pick the deadlines it extends before saving.`,
        quote: o.sourceQuote,
      });
    }
    if (o.additionalDeposit != null && !o.noticeDate) {
      warnings.push({
        kind: "incomplete",
        text: `"${o.label}" needs an extra ${money(o.additionalDeposit)} deposit, but no date to give notice or pay it was found. Check the contract.`,
      });
    }
  });

  items.forEach((item, i) => {
    const d = x.deadlines[i];
    if (item.category === "EARNEST_MONEY" && item.amount == null) {
      warnings.push({ kind: "incomplete", text: `"${item.label}" is a deposit, but no amount was found.` });
    }
    if (d.baseEvent === "OTHER_DEADLINE" && !item.rule) {
      warnings.push({
        kind: "incomplete",
        text: `"${item.label}" is counted from "${d.baseDeadlineLabel ?? "another deadline"}", which isn't in the list, so it can't move with it.`,
      });
    }
    if (!item.dueDate) {
      warnings.push({
        kind: "incomplete",
        text:
          d.baseEvent === "ACCEPTANCE"
            ? `"${item.label}" is counted from acceptance. Add the acceptance date to work out the date.`
            : `"${item.label}" has no date yet. Add one before saving.`,
      });
    }
  });

  return warnings;
}
