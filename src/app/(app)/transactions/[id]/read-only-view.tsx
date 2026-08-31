import Link from "next/link";
import { Eye, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import { DEAL_SIDE_LABELS, DEAL_STATUS_LABELS, dealDisplayName } from "../types";
import type { DealSide, DealStatus } from "@/generated/prisma/enums";

type Row = { label: string; value: string | null };

/**
 * What a manager sees when they open a transaction that isn't theirs.
 *
 * Deliberately a separate view rather than the normal page with its controls
 * disabled. A broker reviewing a file wants to read it, not squint at a form
 * they can't submit -- and building it this way means there's no path where a
 * stray interactive control survives a future edit to the owner's page.
 *
 * The server enforces this independently: every write action is scoped by
 * ownerOnlyFilter, so this view being read-only is a UX decision, not the
 * security boundary.
 */
export function ReadOnlyDealView({
  agentName,
  propertyAddress,
  clientName,
  side,
  status,
  mlsNumber,
  listPrice,
  salePrice,
  closingDate,
  grossCommission,
  deadlines,
  documents,
}: {
  agentName: string | null;
  propertyAddress: string | null;
  clientName: string | null;
  side: DealSide;
  status: DealStatus;
  mlsNumber: string | null;
  listPrice: number | null;
  salePrice: number | null;
  closingDate: string | null;
  grossCommission: number;
  deadlines: { id: string; label: string; dueDate: string; completedAt: string | null }[];
  documents: { id: string; fileName: string; createdAt: string }[];
}) {
  const money = (v: number | null) => (v === null ? null : formatCurrency(v));
  const date = (v: string | null) =>
    v
      ? new Date(v.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  const rows: Row[] = [
    { label: "Client", value: clientName },
    { label: "Side", value: DEAL_SIDE_LABELS[side] ?? side },
    { label: "Status", value: DEAL_STATUS_LABELS[status] ?? status },
    { label: "MLS #", value: mlsNumber },
    { label: "List price", value: money(listPrice) },
    { label: "Sale price", value: money(salePrice) },
    { label: "Closing date", value: date(closingDate) },
    { label: "Commission", value: grossCommission > 0 ? money(grossCommission) : null },
  ].filter((r) => r.value);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/team"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Team
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {dealDisplayName(propertyAddress, clientName)}
        </h1>
        <p className="mt-1 text-sm text-muted">{agentName ?? "An agent"}&apos;s transaction</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <Eye size={17} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-sm text-muted">
          You can read this file and download its paperwork. Only {agentName ?? "the agent"} can
          change it.
        </p>
      </div>

      <Card title="Details">
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{row.label}</dt>
              <dd className="text-right font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Contingencies & deadlines">
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted">None added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deadlines.map((d) => {
              const done = !!d.completedAt;
              const overdue = !done && new Date(d.dueDate) < new Date();
              return (
                <div
                  key={d.id}
                  className="flex items-baseline justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <span className={done ? "text-muted line-through" : "text-foreground"}>
                    {d.label}
                  </span>
                  <span
                    className={`shrink-0 ${overdue ? "text-danger" : "text-muted"}`}
                  >
                    {date(d.dueDate)}
                    {done ? " · Done" : overdue ? " · Overdue" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Documents" icon={FileText} description="Everything filed against this transaction.">
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No paperwork yet"
            description="Nothing has been filed against this transaction."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={`/api/documents/${doc.id}`}
                className="flex flex-col gap-0.5 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 break-words text-sm font-medium text-foreground">
                  {doc.fileName}
                </span>
                <span className="shrink-0 text-sm text-muted">{date(doc.createdAt)}</span>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
