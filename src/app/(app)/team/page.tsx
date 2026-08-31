import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, roleLabel } from "@/lib/authorization";
import { formatCurrency } from "@/lib/format";
import { getSharedTeamFinances } from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { dealDisplayName } from "@/app/(app)/transactions/types";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under Contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Fell Through",
};

export default async function TeamDashboardPage() {
  const session = await auth();

  if (!isManager(session!.user.role) || !session!.user.teamId) {
    redirect("/dashboard");
  }

  const teamId = session!.user.teamId;
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1));
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [teammates, deals, upcomingDeadlines, missingDocDeals, archivedDeals, sharedFinances] =
    await Promise.all([
    prisma.user.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.deal.findMany({
      where: { user: { teamId } },
      select: { userId: true, status: true, commissionAmount: true, closingDate: true },
    }),
    prisma.dealDeadline.findMany({
      where: {
        completedAt: null,
        dueDate: { lte: soon },
        deal: { user: { teamId } },
      },
      include: { deal: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.deal.findMany({
      where: {
        user: { teamId },
        status: { in: ["UNDER_CONTRACT", "PENDING"] },
        documents: { none: {} },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    // Records retained for agents who have since left. Read-only by
    // construction: this is the only query in the app that reads
    // archivedTeamId, and no edit or delete path touches it. The deals still
    // belong to the agent -- userId is untouched -- so nothing here is the
    // brokerage's to change.
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
    // Only ever returns agents who switched sharing on themselves -- the
    // filtering happens in the query, so a non-sharer's numbers never exist
    // here to be leaked by a rendering mistake. See getSharedTeamFinances.
    getSharedTeamFinances(teamId, currentYear),
  ]);

  const statsByAgent = new Map(
    teammates.map((t) => [t.id, { active: 0, closed: 0, commission: 0 }]),
  );

  for (const deal of deals) {
    const stats = statsByAgent.get(deal.userId);
    if (!stats) continue;

    if (deal.status === "CLOSED") {
      const closedInYear =
        deal.closingDate && deal.closingDate >= yearStart && deal.closingDate < yearEnd;
      if (closedInYear) {
        stats.closed += 1;
        stats.commission += deal.commissionAmount ? Number(deal.commissionAmount) : 0;
      }
    } else if (deal.status === "ACTIVE" || deal.status === "UNDER_CONTRACT" || deal.status === "PENDING") {
      stats.active += 1;
    }
  }

  const totals = [...statsByAgent.values()].reduce(
    (acc, s) => ({
      active: acc.active + s.active,
      closed: acc.closed + s.closed,
      commission: acc.commission + s.commission,
    }),
    { active: 0, closed: 0, commission: 0 },
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Office-wide overview of agents, deals, and deadlines.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Agents" value={teammates.length.toString()} />
        <SummaryCard label="Active deals" value={totals.active.toString()} />
        <SummaryCard label={`Closed (${currentYear})`} value={totals.closed.toString()} />
        <SummaryCard label={`Commission (${currentYear})`} value={formatCurrency(totals.commission)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Agents</h2>
        <div className="flex flex-col gap-2">
          {teammates.map((t) => {
            const stats = statsByAgent.get(t.id)!;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                  <span className="text-sm text-muted">
                    {t.email} · {roleLabel(t.role)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-6 text-sm text-muted">
                  <span>{stats.active} active</span>
                  <span>{stats.closed} closed</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(stats.commission)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Upcoming &amp; overdue contingencies
        </h2>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-muted">Nothing due in the next 7 days.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((d) => {
              const isOverdue = d.dueDate < now;
              return (
                <Link
                  key={d.id}
                  href={`/transactions/${d.dealId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {d.label} — {dealDisplayName(d.deal.propertyAddress)}
                    </span>
                    <span className="text-sm text-muted">{d.deal.user.name}</span>
                  </div>
                  <span className={`text-sm font-medium ${isOverdue ? "text-danger" : "text-muted"}`}>
                    {d.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {isOverdue ? " · Overdue" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Missing documents</h2>
        {missingDocDeals.length === 0 ? (
          <p className="text-sm text-muted">
            Every active transaction has at least one document attached. Nice.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {missingDocDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/transactions/${deal.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {dealDisplayName(deal.propertyAddress)}
                  </span>
                  <span className="text-sm text-muted">{deal.user.name}</span>
                </div>
                <span className="text-sm font-medium text-danger">
                  {STATUS_LABELS[deal.status]} · No documents
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Absent entirely when nobody has opted in, rather than an empty
          section nudging a broker to go ask. Sharing is the agent's call. */}
      {sharedFinances.length > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="text-base font-semibold text-foreground">Shared finances</h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            Totals for {currentYear}, from agents who chose to share them. Business only — nobody
            can share their personal investments, loans or clients with you.
          </p>
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
                      <span className="font-medium text-foreground">
                        {formatCurrency(agent.businessNet)} net
                      </span>
                    </>
                  ) : null}
                  {agent.mileageDeduction !== null ? (
                    <span>
                      {Math.round(agent.mileageMiles ?? 0).toLocaleString()} mi ·{" "}
                      {formatCurrency(agent.mileageDeduction)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Only rendered when there's something in it -- a brokerage that has
          never had anyone leave shouldn't carry an empty compliance section. */}
      {archivedDeals.length > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="text-base font-semibold text-foreground">Former agents</h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            Transactions that closed under your brokerage before the agent left. Kept for your
            records — these belong to the agent, so they&apos;re read-only here.
          </p>
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
                    {deal.closingDate
                      ? ` · Closed ${deal.closingDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : ""}
                  </span>
                </div>
                <span className="shrink-0 text-sm text-muted">
                  {deal.commissionAmount ? formatCurrency(Number(deal.commissionAmount)) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
