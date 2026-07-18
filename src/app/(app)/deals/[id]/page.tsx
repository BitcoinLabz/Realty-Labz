import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
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
      include: { deadlines: { orderBy: { dueDate: "asc" } } },
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
        <h2 className="mb-6 text-base font-semibold text-foreground">Deadlines</h2>
        <DeadlineList dealId={deal.id} deadlines={deadlineDtos} />
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
