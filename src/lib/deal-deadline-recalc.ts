import { prisma } from "@/lib/db";
import { changedDeadlines, type RuleDeadline } from "@/lib/deadline-rules";

// Loads a transaction's deadlines as rules (2026-11-19). Callers must have
// already checked the caller may WRITE this deal (ownerOnlyFilter) -- this
// helper only reads and writes by dealId.

type DeadlineRow = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(dealId: string) {
  return prisma.dealDeadline.findMany({
    where: { dealId },
    select: {
      id: true,
      label: true,
      dueDate: true,
      completedAt: true,
      baseEvent: true,
      baseDeadlineId: true,
      offsetDays: true,
      dayType: true,
      extensionDays: true,
      category: true,
    },
    orderBy: { dueDate: "asc" },
  });
}

export function toRuleDeadline(d: DeadlineRow): RuleDeadline {
  return {
    id: d.id,
    label: d.label,
    rule:
      d.baseEvent && d.offsetDays != null
        ? { baseEvent: d.baseEvent, baseDeadlineId: d.baseDeadlineId, offsetDays: d.offsetDays, dayType: d.dayType }
        : null,
    dueDate: d.dueDate,
    extensionDays: d.extensionDays,
    isClosing: d.category === "CLOSING",
    completed: !!d.completedAt,
  };
}

export async function loadRuleDeadlines(dealId: string) {
  const [deal, rows] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, select: { acceptanceDate: true, closingDate: true } }),
    loadRows(dealId),
  ]);
  return {
    dates: { acceptanceDate: deal?.acceptanceDate ?? null, closingDate: deal?.closingDate ?? null },
    deadlines: rows.map(toRuleDeadline),
  };
}

/**
 * Re-works every rule deadline on a transaction and saves the ones whose
 * date changed. Completed deadlines are left as they were (re-dating
 * something already checked off would be a surprise). A moved deadline's
 * automatic-reminder stamps are cleared so the client hears about the NEW
 * date. If the closing deadline moves, the deal's closing date follows.
 */
export async function recalculateDealDeadlines(dealId: string): Promise<number> {
  const { dates, deadlines } = await loadRuleDeadlines(dealId);
  const changes = changedDeadlines(deadlines, dates).filter((c) => !deadlines.find((d) => d.id === c.id)?.completed);
  if (changes.length === 0) return 0;

  const closing = deadlines.find((d) => d.isClosing);
  const closingChange = closing ? changes.find((c) => c.id === closing.id) : undefined;

  await prisma.$transaction([
    ...changes.map((c) =>
      prisma.dealDeadline.updateMany({
        where: { id: c.id, dealId },
        data: { dueDate: c.dueDate, autoReminderEarlySentAt: null, autoReminderFinalSentAt: null },
      }),
    ),
    ...(closingChange ? [prisma.deal.update({ where: { id: dealId }, data: { closingDate: closingChange.dueDate } })] : []),
  ]);
  return changes.length;
}
