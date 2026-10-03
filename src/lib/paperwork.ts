import type { DealSide } from "@/generated/prisma/enums";

// The office's paperwork list on one file (2026-10-02). Pure, so the counting
// rule is unit-tested rather than trusted (paperwork.test.ts).
//
// No approval workflow, by founder decision: an item is satisfied the moment
// a document filed against it is on the transaction.

export type Requirement = { id: string; label: string; sides: DealSide[]; order: number };
export type FiledDocument = { id: string; fileName: string; requirementId: string | null };

export type PaperworkItem = {
  requirement: Requirement;
  // The newest document filed against it, or null while it's missing.
  document: FiledDocument | null;
};

export function paperworkStatus(
  requirements: Requirement[],
  documents: FiledDocument[], // newest first
  side: DealSide,
): { items: PaperworkItem[]; onFile: number; total: number } {
  const items = requirements
    .filter((r) => r.sides.includes(side))
    .sort((a, b) => a.order - b.order)
    .map((requirement) => ({
      requirement,
      document: documents.find((d) => d.requirementId === requirement.id) ?? null,
    }));
  const onFile = items.filter((i) => i.document).length;
  return { items, onFile, total: items.length };
}
