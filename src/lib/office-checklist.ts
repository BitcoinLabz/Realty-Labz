import { prisma } from "@/lib/db";
import type { DealStatus } from "@/generated/prisma/enums";

// The checklist most offices run on every file -- the fallback when an office
// hasn't set up its own (Office settings -> Office checklist).
export const STANDARD_OFFICE_CHECKLIST = [
  "Title ordered",
  "Closing scheduled",
  "Sign ordered",
  "Sign installed",
  "Sign removed",
  "Commission received",
];

// When a file gets its office checklist automatically (2026-10-02): the
// moment it's under contract, for an agent on a team, and only if it has no
// office tasks yet -- so it never duplicates, and an office that deleted
// items on purpose doesn't get them back. Pure and unit-tested.
export function shouldApplyOfficeChecklist(params: {
  status: DealStatus;
  agentOnTeam: boolean;
  existingTasks: number;
}): boolean {
  const underContract = params.status === "UNDER_CONTRACT" || params.status === "PENDING";
  return underContract && params.agentOnTeam && params.existingTasks === 0;
}

// The labels a team's checklist starts from: its own template, or the
// standard six when it hasn't made one.
export async function officeChecklistLabels(teamId: string): Promise<string[]> {
  const items = await prisma.officeChecklistItem.findMany({
    where: { teamId },
    orderBy: { order: "asc" },
    select: { label: true },
  });
  return items.length > 0 ? items.map((i) => i.label) : STANDARD_OFFICE_CHECKLIST;
}

// Called from every path that can put a file under contract (updating the
// transaction, starting one from a signed contract, saving a contract
// read). Safe to call repeatedly -- shouldApplyOfficeChecklist makes it a
// no-op after the first time. createdById is whoever triggered it.
export async function applyOfficeChecklist(dealId: string, triggeredById: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      status: true,
      user: { select: { teamId: true } },
      _count: { select: { officeTasks: true } },
    },
  });
  if (!deal) return;

  const teamId = deal.user.teamId;
  if (
    !teamId ||
    !shouldApplyOfficeChecklist({
      status: deal.status,
      agentOnTeam: true,
      existingTasks: deal._count.officeTasks,
    })
  ) {
    return;
  }

  const labels = await officeChecklistLabels(teamId);
  await prisma.officeTask.createMany({
    data: labels.map((label, order) => ({ dealId, label, order, createdById: triggeredById })),
  });
}
