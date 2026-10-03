import { prisma } from "@/lib/db";
import { teamSharedDealsFilter } from "@/lib/authorization";
import { isDeadlineOverdue, todayInReminderZone } from "@/lib/deadline-reminder-schedule";
import { paperworkStatus } from "@/lib/paperwork";
import { dealDisplayName } from "@/app/(app)/transactions/types";

// What needs an office's attention today (2026-10-02), for the broker's
// morning email. Same rules as the Overview's "Needs attention": only files
// the agent has shared, overdue = before today in Michigan, paperwork per
// the office's list.

const DAY_MS = 24 * 60 * 60 * 1000;

export type SummaryLine = { dealId: string; title: string; detail: string };

export type OfficeSummary = {
  overdue: SummaryLine[];
  missingPaperwork: SummaryLine[];
  officeTasksDue: SummaryLine[];
  closingsThisWeek: SummaryLine[];
};

export function summaryIsEmpty(s: OfficeSummary): boolean {
  return (
    s.overdue.length + s.missingPaperwork.length + s.officeTasksDue.length + s.closingsThisWeek.length === 0
  );
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export async function getOfficeSummary(teamId: string, now = new Date()): Promise<OfficeSummary> {
  const shared = teamSharedDealsFilter(teamId);
  const today = todayInReminderZone(now);
  const inAWeek = new Date(today.getTime() + 7 * DAY_MS);

  const [deadlines, tasks, underContract, requirements, closings] = await Promise.all([
    prisma.dealDeadline.findMany({
      where: { completedAt: null, dueDate: { lt: today }, deal: shared },
      include: { deal: { select: { id: true, propertyAddress: true, user: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    // Office tasks due today or already late.
    prisma.officeTask.findMany({
      where: { completedAt: null, dueDate: { not: null, lt: new Date(today.getTime() + DAY_MS) }, deal: shared },
      include: { deal: { select: { id: true, propertyAddress: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.deal.findMany({
      where: { ...shared, status: { in: ["UNDER_CONTRACT", "PENDING"] } },
      select: {
        id: true,
        side: true,
        propertyAddress: true,
        user: { select: { name: true } },
        documents: { select: { id: true, fileName: true, requirementId: true } },
      },
    }),
    prisma.requiredDocument.findMany({ where: { teamId }, orderBy: { order: "asc" } }),
    prisma.deal.findMany({
      where: { ...shared, status: { in: ["UNDER_CONTRACT", "PENDING"] }, closingDate: { gte: today, lt: inAWeek } },
      select: { id: true, propertyAddress: true, closingDate: true, user: { select: { name: true } } },
      orderBy: { closingDate: "asc" },
    }),
  ]);

  const missingPaperwork: SummaryLine[] = [];
  for (const deal of underContract) {
    if (requirements.length === 0) {
      if (deal.documents.length === 0) {
        missingPaperwork.push({
          dealId: deal.id,
          title: dealDisplayName(deal.propertyAddress),
          detail: `${deal.user.name ?? "Agent"} · no documents yet`,
        });
      }
      continue;
    }
    const status = paperworkStatus(requirements, deal.documents, deal.side);
    const missing = status.total - status.onFile;
    if (missing > 0) {
      missingPaperwork.push({
        dealId: deal.id,
        title: dealDisplayName(deal.propertyAddress),
        detail: `${deal.user.name ?? "Agent"} · ${missing} of ${status.total} documents missing`,
      });
    }
  }

  return {
    overdue: deadlines
      .filter((d) => isDeadlineOverdue(d.dueDate, now))
      .map((d) => ({
        dealId: d.deal.id,
        title: `${d.label} — ${dealDisplayName(d.deal.propertyAddress)}`,
        detail: `${d.deal.user.name ?? "Agent"} · was due ${shortDate(d.dueDate)}`,
      })),
    missingPaperwork,
    officeTasksDue: tasks.map((t) => ({
      dealId: t.deal.id,
      title: `${t.label} — ${dealDisplayName(t.deal.propertyAddress)}`,
      detail: t.dueDate && isDeadlineOverdue(t.dueDate, now) ? `late, was due ${shortDate(t.dueDate)}` : "due today",
    })),
    closingsThisWeek: closings.map((d) => ({
      dealId: d.id,
      title: dealDisplayName(d.propertyAddress),
      detail: `${d.user.name ?? "Agent"} · closing ${shortDate(d.closingDate!)}`,
    })),
  };
}
