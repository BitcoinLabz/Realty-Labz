import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { isManager, teamOrOwnFilter } from "@/lib/authorization";
import { DealForm } from "./deal-form";
import type { DealDTO } from "./types";

const STATUS_LABELS: Record<DealDTO["status"], string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under Contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Fell Through",
};

const STATUS_COLORS: Record<DealDTO["status"], string> = {
  ACTIVE: "text-accent",
  UNDER_CONTRACT: "text-accent",
  PENDING: "text-muted",
  CLOSED: "text-foreground",
  FELL_THROUGH: "text-danger",
};

export default async function DealsPage() {
  const session = await auth();
  const showAgentColumn = isManager(session!.user.role) && !!session!.user.teamId;

  const [deals, clients] = await Promise.all([
    prisma.deal.findMany({
      where: teamOrOwnFilter(session!.user),
      include: { client: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: teamOrOwnFilter(session!.user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const dtos: DealDTO[] = deals.map((d) => ({
    id: d.id,
    side: d.side,
    status: d.status,
    propertyAddress: d.propertyAddress,
    mlsNumber: d.mlsNumber,
    listPrice: d.listPrice ? Number(d.listPrice) : null,
    salePrice: d.salePrice ? Number(d.salePrice) : null,
    commissionRate: d.commissionRate ? Number(d.commissionRate) : null,
    commissionAmount: d.commissionAmount ? Number(d.commissionAmount) : null,
    closingDate: d.closingDate ? d.closingDate.toISOString().slice(0, 10) : null,
    notes: d.notes,
    clientId: d.clientId,
    clientName: d.client?.name ?? null,
    agentId: d.userId,
    agentName: d.user.name ?? d.user.email,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Deals</h1>
        <p className="mt-1 text-sm text-muted">
          {showAgentColumn
            ? "Track buyer and seller transactions across your team."
            : "Track your buyer and seller transactions."}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a deal</h2>
        <div className="max-w-md">
          <DealForm clients={clients} />
        </div>
      </section>

      {dtos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
          No deals yet. Add your first one above.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dtos.map((deal) => (
            <Link
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4 transition-colors hover:border-accent"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{deal.propertyAddress}</span>
                <span className="text-sm text-muted">
                  {deal.side === "BUYER" ? "Buyer" : deal.side === "SELLER" ? "Seller" : "Dual"}
                  {deal.clientName ? ` · ${deal.clientName}` : ""}
                  {showAgentColumn ? ` · ${deal.agentName}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {deal.salePrice ? (
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(deal.salePrice)}
                  </span>
                ) : null}
                <span className={`text-sm font-medium ${STATUS_COLORS[deal.status]}`}>
                  {STATUS_LABELS[deal.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
