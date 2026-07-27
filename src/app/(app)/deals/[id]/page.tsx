import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { formatCurrency, formatFileSize } from "@/lib/format";
import { calculateNetCommission } from "@/lib/finance-data";
import { DealForm, type DealFormValues } from "../deal-form";
import { DeadlineList } from "./deadline-list";
import { DeleteDealButton } from "./delete-deal-button";
import type { DealDeadlineDTO } from "../types";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [deal, clients] = await Promise.all([
    prisma.deal.findFirst({
      where: { id, ...teamOrOwnFilter(session!.user) },
      include: {
        deadlines: { orderBy: { dueDate: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        client: { select: { id: true, name: true } },
        expenses: { where: { type: "EXPENSE" }, orderBy: { date: "desc" } },
      },
    }),
    prisma.client.findMany({
      where: teamOrOwnFilter(session!.user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!deal) notFound();

  const defaultValues: DealFormValues = {
    id: deal.id,
    side: deal.side,
    status: deal.status,
    propertyAddress: deal.propertyAddress,
    mlsNumber: deal.mlsNumber ?? "",
    listPrice: deal.listPrice ? String(deal.listPrice) : "",
    salePrice: deal.salePrice ? String(deal.salePrice) : "",
    commissionRate: deal.commissionRate ? String(deal.commissionRate) : "",
    commissionAmount: deal.commissionAmount ? String(deal.commissionAmount) : "",
    brokerageSplitPercent: deal.brokerageSplitPercent ? String(deal.brokerageSplitPercent) : "",
    referralFeeAmount: deal.referralFeeAmount ? String(deal.referralFeeAmount) : "",
    teamSplitAmount: deal.teamSplitAmount ? String(deal.teamSplitAmount) : "",
    otherDeductions: deal.otherDeductions ? String(deal.otherDeductions) : "",
    closingDate: deal.closingDate ? deal.closingDate.toISOString().slice(0, 10) : "",
    notes: deal.notes ?? "",
    clientId: deal.clientId ?? "",
  };

  const grossCommission = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
  const netCommission = calculateNetCommission(grossCommission, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeeAmount: deal.referralFeeAmount ? Number(deal.referralFeeAmount) : null,
    teamSplitAmount: deal.teamSplitAmount ? Number(deal.teamSplitAmount) : null,
    otherDeductions: deal.otherDeductions ? Number(deal.otherDeductions) : null,
  });
  const dealExpenseTotal = deal.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const dealProfit = netCommission - dealExpenseTotal;
  const hasCommissionSplits =
    deal.brokerageSplitPercent || deal.referralFeeAmount || deal.teamSplitAmount || deal.otherDeductions;

  const deadlineDtos: DealDeadlineDTO[] = deal.deadlines.map((d) => ({
    id: d.id,
    label: d.label,
    dueDate: d.dueDate.toISOString().slice(0, 10),
    completedAt: d.completedAt ? d.completedAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={deal.client ? `/forms/${deal.client.id}` : "/forms"}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to {deal.client ? deal.client.name : "Clients"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {deal.propertyAddress}
        </h1>
        <p className="mt-1 text-sm text-muted">Manage this deal&apos;s details and deadlines.</p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Deal details</h2>
        <div className="max-w-md">
          <DealForm
            key={deal.updatedAt.toISOString()}
            clients={clients}
            defaultValues={defaultValues}
          />
        </div>
      </section>

      {grossCommission > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-6 text-base font-semibold text-foreground">Deal financials</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Gross commission</span>
              <span className="font-medium text-foreground">{formatCurrency(grossCommission)}</span>
            </div>
            {hasCommissionSplits ? (
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted">Net commission (after splits)</span>
                <span className="font-medium text-foreground">{formatCurrency(netCommission)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted">
                Deal expenses{deal.expenses.length > 0 ? ` (${deal.expenses.length})` : ""}
              </span>
              <span className="font-medium text-foreground">
                {dealExpenseTotal > 0 ? `-${formatCurrency(dealExpenseTotal)}` : formatCurrency(0)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold text-foreground">Deal profit</span>
              <span className={`font-semibold ${dealProfit >= 0 ? "text-accent" : "text-danger"}`}>
                {formatCurrency(dealProfit)}
              </span>
            </div>
          </div>

          {deal.expenses.length > 0 ? (
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              {deal.expenses.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{t.description || "Expense"}</span>
                  <span className="text-muted">{formatCurrency(Number(t.amount))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              No expenses linked to this deal yet — link one from{" "}
              <a href="/finances/transactions" className="font-medium text-accent hover:opacity-80">
                Transactions
              </a>
              .
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Contingencies &amp; deadlines
        </h2>
        <DeadlineList dealId={deal.id} deadlines={deadlineDtos} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Documents</h2>
          <Link
            href={deal.client ? `/forms/${deal.client.id}` : "/forms"}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            {deal.client ? `Manage on ${deal.client.name}'s page` : "Manage on the Clients tab"}
          </Link>
        </div>
        {deal.documents.length === 0 ? (
          <p className="text-sm text-muted">
            No documents linked yet. Upload one from{" "}
            {deal.client ? `${deal.client.name}'s page` : "the Clients page"} and link it to this deal.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deal.documents.map((doc) => (
              <a
                key={doc.id}
                href={`/api/documents/${doc.id}`}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:border-accent"
              >
                <span className="text-sm font-medium text-foreground">{doc.fileName}</span>
                <span className="text-sm text-muted">{formatFileSize(doc.size)}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Danger zone</h2>
        <p className="mb-4 text-sm text-muted">
          Deleting a deal also removes its deadlines. Linked documents and clients are kept.
        </p>
        <DeleteDealButton dealId={deal.id} propertyAddress={deal.propertyAddress} />
      </section>
    </div>
  );
}
