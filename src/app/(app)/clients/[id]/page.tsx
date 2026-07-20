import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatFileSize } from "@/lib/format";
import { ClientForm, type ClientFormValues } from "../client-form";
import { DeleteClientButton } from "./delete-client-button";
import { DealForm } from "../../deals/deal-form";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under Contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Fell Through",
};

const SIDE_LABELS: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  DUAL: "Dual",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const client = await prisma.client.findFirst({
    where: { id, userId: session!.user.id },
  });

  if (!client) notFound();

  const [deals, documents] = await Promise.all([
    prisma.deal.findMany({
      where: { clientId: client.id, userId: session!.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { clientId: client.id, userId: session!.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const defaultValues: ClientFormValues = {
    id: client.id,
    name: client.name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    notes: client.notes ?? "",
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/clients"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{client.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Contact info, properties, and documents for this client.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Contact info</h2>
        <div className="max-w-md">
          <ClientForm key={client.updatedAt.toISOString()} defaultValues={defaultValues} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Properties &amp; offers</h2>

        {deals.length === 0 ? (
          <p className="mb-6 text-sm text-muted">
            No properties or offers yet for {client.name}. Add one below.
          </p>
        ) : (
          <div className="mb-6 flex flex-col gap-2">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {deal.propertyAddress}
                  </span>
                  <span className="text-sm text-muted">{SIDE_LABELS[deal.side]}</span>
                </div>
                <span className="text-sm font-medium text-muted">
                  {STATUS_LABELS[deal.status]}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="max-w-md border-t border-border pt-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Add a deal</h3>
          <DealForm lockedClientId={client.id} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Documents</h2>
          <Link href="/documents" className="text-sm font-medium text-accent hover:opacity-80">
            Manage on Documents page
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">No documents linked yet for {client.name}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
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
          Deleting a client keeps their deals and documents, just unlinked.
        </p>
        <DeleteClientButton clientId={client.id} clientName={client.name} />
      </section>
    </div>
  );
}
