import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { formatFileSize } from "@/lib/format";
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
    closingDate: deal.closingDate ? deal.closingDate.toISOString().slice(0, 10) : "",
    notes: deal.notes ?? "",
    clientId: deal.clientId ?? "",
  };

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
          href={deal.client ? `/clients/${deal.client.id}` : "/clients"}
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

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Contingencies &amp; deadlines
        </h2>
        <DeadlineList dealId={deal.id} deadlines={deadlineDtos} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Documents</h2>
          <Link href="/documents" className="text-sm font-medium text-accent hover:opacity-80">
            Manage on Documents page
          </Link>
        </div>
        {deal.documents.length === 0 ? (
          <p className="text-sm text-muted">
            No documents linked yet. Upload one on the Documents page and link it here.
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
