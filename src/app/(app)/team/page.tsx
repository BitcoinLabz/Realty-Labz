import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  EyeOff,
  FileWarning,
  Home,
  KeyRound,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, isOversightRole, roleLabel, teamSharedDealsFilter } from "@/lib/authorization";
import { isDeadlineOverdue, todayInReminderZone } from "@/lib/deadline-reminder-schedule";
import { formatCurrency } from "@/lib/format";
import { getSharedTeamFinances } from "@/lib/finance-data";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCard } from "@/components/ui/summary-card";
import { DEAL_STATUS_LABELS, dealDisplayName } from "@/app/(app)/transactions/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(date: Date) {
  // Deadlines and closings are date-only values stored at UTC midnight.
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// The brokerage's home (2026-10-01): a Broker or office Admin lands here and
// never sees an agent's own Dashboard, Clients or Finances. Team Leads see it
// too, alongside their own agent work.
//
// Every transaction query goes through teamSharedDealsFilter, so a file an
// agent switched "Share with my brokerage" off on never appears here -- only
// as a count per agent, so nothing drops out of supervision silently.
export default async function TeamOverviewPage() {
  const session = await auth();

  if (!isManager(session!.user.role) || !session!.user.teamId) {
    redirect("/dashboard");
  }

  const teamId = session!.user.teamId;
  const shared = teamSharedDealsFilter(teamId);
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1));
  const now = new Date();
  const today = todayInReminderZone(now);
  const inAWeek = new Date(today.getTime() + 7 * DAY_MS);
  const inAMonth = new Date(today.getTime() + 30 * DAY_MS);

  const [
    team,
    teammates,
    deals,
    hiddenByAgent,
    deadlines,
    missingDocDeals,
    officeTasks,
    closings,
    archivedDeals,
    sharedFinances,
  ] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    prisma.user.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.deal.findMany({
      where: shared,
      select: { userId: true, status: true, commissionAmount: true, closingDate: true },
    }),
    // Counts only -- never the files themselves.
    prisma.deal.groupBy({
      by: ["userId"],
      where: { user: { teamId }, sharedWithBrokerage: false, userId: { not: session!.user.id } },
      _count: { _all: true },
    }),
    prisma.dealDeadline.findMany({
      where: { completedAt: null, dueDate: { lt: inAWeek }, deal: shared },
      include: { deal: { select: { id: true, propertyAddress: true, user: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.deal.findMany({
      where: { ...shared, status: { in: ["UNDER_CONTRACT", "PENDING"] }, documents: { none: {} } },
      select: { id: true, status: true, propertyAddress: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.officeTask.findMany({
      where: { completedAt: null, dueDate: { not: null, lt: inAWeek }, deal: shared },
      include: { deal: { select: { id: true, propertyAddress: true, user: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.deal.findMany({
      where: {
        ...shared,
        status: { in: ["UNDER_CONTRACT", "PENDING"] },
        closingDate: { gte: today, lt: inAMonth },
      },
      select: { id: true, status: true, propertyAddress: true, closingDate: true, user: { select: { name: true } } },
      orderBy: { closingDate: "asc" },
    }),
    // Records retained for agents who have since left. Read-only by
    // construction: this is the only query in the app that reads
    // archivedTeamId, and no edit or delete path touches it.
    prisma.deal.findMany({
      where: { archivedTeamId: teamId },
      select: {
        id: true,
        propertyAddress: true,
        closingDate: true,
        commissionAmount: true,
        user: { select: { name: true } },
      },
      orderBy: { closingDate: "desc" },
    }),
    // Only agents who switched sharing on themselves -- filtered in the
    // query. See getSharedTeamFinances.
    getSharedTeamFinances(teamId, currentYear),
  ]);

  // Brokers and office admins carry no files, so they aren't "agents" here.
  const agents = teammates.filter((t) => !isOversightRole(t.role));
  const hiddenCount = new Map(hiddenByAgent.map((h) => [h.userId, h._count._all]));
  const statsByAgent = new Map(teammates.map((t) => [t.id, { active: 0, closed: 0, commission: 0 }]));
  let underContract = 0;
  for (const deal of deals) {
    const stats = statsByAgent.get(deal.userId);
    if (!stats) continue;
    if (deal.status === "CLOSED") {
      if (deal.closingDate && deal.closingDate >= yearStart && deal.closingDate < yearEnd) {
        stats.closed += 1;
        stats.commission += deal.commissionAmount ? Number(deal.commissionAmount) : 0;
      }
    } else if (deal.status !== "FELL_THROUGH") {
      stats.active += 1;
      if (deal.status === "UNDER_CONTRACT" || deal.status === "PENDING") underContract += 1;
    }
  }
  const activeTotal = [...statsByAgent.values()].reduce((n, s) => n + s.active, 0);

  const overdue = deadlines.filter((d) => isDeadlineOverdue(d.dueDate, now));
  const comingUp = deadlines.filter((d) => !isDeadlineOverdue(d.dueDate, now));
  const attentionCount = overdue.length + missingDocDeals.length + officeTasks.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={team?.name ?? "Your brokerage"}
        description="Your agents' transactions, deadlines and office work, at a glance."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Agents" value={agents.length.toString()} icon={Users} tone="violet" />
        <SummaryCard label="Active" value={activeTotal.toString()} icon={Home} tone="accent" />
        <SummaryCard label="Under contract" value={underContract.toString()} icon={KeyRound} tone="warning" />
        <SummaryCard label="Closing in 30 days" value={closings.length.toString()} icon={BadgeCheck} tone="success" />
      </div>

      <Card
        title="Needs attention"
        icon={FileWarning}
        tone="danger"
        description="Missed dates, files with no paperwork, and office tasks due this week."
      >
        {attentionCount === 0 ? (
          <p className="text-sm text-muted">Nothing needs you right now.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {overdue.map((d) => (
              <Link
                key={d.id}
                href={`/transactions/${d.deal.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{d.label}</span>
                  <span className="text-muted"> · {dealDisplayName(d.deal.propertyAddress)} · {d.deal.user.name}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-danger">Was due {shortDate(d.dueDate)}</span>
              </Link>
            ))}
            {officeTasks.map((t) => (
              <Link
                key={t.id}
                href={`/transactions/${t.deal.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{t.label}</span>
                  <span className="text-muted"> · Office · {dealDisplayName(t.deal.propertyAddress)}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-medium ${
                    t.dueDate && isDeadlineOverdue(t.dueDate, now) ? "text-danger" : "text-warning"
                  }`}
                >
                  Due {t.dueDate ? shortDate(t.dueDate) : ""}
                </span>
              </Link>
            ))}
            {missingDocDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/transactions/${deal.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{dealDisplayName(deal.propertyAddress)}</span>
                  <span className="text-muted"> · {deal.user.name}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-danger">
                  {DEAL_STATUS_LABELS[deal.status]} · No documents
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card title="Coming up" icon={CalendarClock} tone="warning" description="Deadlines this week and closings in the next 30 days.">
        {comingUp.length === 0 && closings.length === 0 ? (
          <p className="text-sm text-muted">Nothing due in the next week, and no closings this month.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {closings.map((deal) => (
              <Link
                key={deal.id}
                href={`/transactions/${deal.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">Closing</span>
                  <span className="text-muted"> · {dealDisplayName(deal.propertyAddress)} · {deal.user.name}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-success">{shortDate(deal.closingDate!)}</span>
              </Link>
            ))}
            {comingUp.map((d) => (
              <Link
                key={d.id}
                href={`/transactions/${d.deal.id}`}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{d.label}</span>
                  <span className="text-muted"> · {dealDisplayName(d.deal.propertyAddress)} · {d.deal.user.name}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">{shortDate(d.dueDate)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Agents"
        icon={Users}
        tone="violet"
        action={
          <Link href="/account#team" className="text-sm font-medium text-accent hover:opacity-80">
            Invite or manage
          </Link>
        }
      >
        {agents.length === 0 ? (
          // A brand-new brokerage: the one thing to do is link an agent.
          <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-5">
            <p className="text-sm font-medium text-foreground">Add your first agent</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
              <li>Invite them by their license number, or create an invite link and send it to them.</li>
              <li>They open it — signed in if they already use Realty Labz, or they create an account.</li>
              <li>Once they join, their transactions show up here.</li>
            </ol>
            <Link href="/account#team" className="text-sm font-medium text-accent hover:opacity-80">
              Invite an agent →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((t) => {
              const stats = statsByAgent.get(t.id)!;
              const hidden = hiddenCount.get(t.id) ?? 0;
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <span className="truncate text-sm text-muted">
                      {t.email} · {roleLabel(t.role)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                    <span>{stats.active} active</span>
                    <span>{stats.closed} closed</span>
                    <span className="font-medium text-foreground">{formatCurrency(stats.commission)}</span>
                    {/* The mitigation for the agent's hide switch: the broker
                        always knows a file exists, even when they can't open it. */}
                    {hidden > 0 ? (
                      <span className="inline-flex items-center gap-1 text-warning" title="Transactions this agent hasn't shared">
                        <EyeOff size={14} />
                        {hidden} not shared
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Absent entirely when nobody has opted in, rather than an empty
          section nudging a broker to go ask. Sharing is the agent's call. */}
      {sharedFinances.length > 0 ? (
        <Card
          title="Shared finances"
          icon={ClipboardList}
          tone="success"
          description={`Totals for ${currentYear}, from agents who chose to share them. Business only — nobody can share their personal investments, loans or clients with you.`}
        >
          <div className="flex flex-col gap-2">
            {sharedFinances.map((agent) => (
              <div
                key={agent.userId}
                className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
                <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
                  {agent.businessNet !== null ? (
                    <>
                      <span>{formatCurrency(agent.businessIncome ?? 0)} in</span>
                      <span>{formatCurrency(agent.businessExpenses ?? 0)} out</span>
                      <span className="font-medium text-foreground">{formatCurrency(agent.businessNet)} net</span>
                    </>
                  ) : null}
                  {agent.mileageDeduction !== null ? (
                    <span>
                      {Math.round(agent.mileageMiles ?? 0).toLocaleString()} mi · {formatCurrency(agent.mileageDeduction)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Only rendered when there's something in it -- a brokerage that has
          never had anyone leave shouldn't carry an empty compliance section. */}
      {archivedDeals.length > 0 ? (
        <Card
          title="Former agents"
          description="Transactions that closed under your brokerage before the agent left. Kept for your records — these belong to the agent, so they're read-only here."
        >
          <div className="flex flex-col gap-2">
            {archivedDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex flex-col gap-1 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {dealDisplayName(deal.propertyAddress)}
                  </span>
                  <span className="text-sm text-muted">
                    {deal.user.name}
                    {deal.closingDate ? ` · Closed ${shortDate(deal.closingDate)}` : ""}
                  </span>
                </div>
                <span className="shrink-0 text-sm text-muted">
                  {deal.commissionAmount ? formatCurrency(Number(deal.commissionAmount)) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
