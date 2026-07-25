import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamSharedFilter } from "@/lib/authorization";
import { ClientForm, type ClientFormValues } from "../client-form";
import { DeleteClientButton } from "./delete-client-button";
import { DealForm } from "../../deals/deal-form";
import { ClientDocuments } from "./client-documents";
import { SendFormWidget, type SendableTemplate } from "./send-form-widget";
import { ClientFormSubmissions } from "./client-form-submissions";
import type { DocumentDTO } from "../types";
import type { FormSubmissionSummaryDTO } from "../templates/types";

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

  const [deals, documents, formTemplates, formSubmissions] = await Promise.all([
    prisma.deal.findMany({
      where: { clientId: client.id, userId: session!.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { clientId: client.id, userId: session!.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: { signers: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formSubmission.findMany({
      where: { clientId: client.id, userId: session!.user.id },
      include: { formTemplate: true, signers: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sendableTemplates: SendableTemplate[] = formTemplates
    .filter((t) => t.signers.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      signers: t.signers.map((s) => ({ id: s.id, order: s.order, label: s.label })),
    }));

  const documentDtos: DocumentDTO[] = documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    clientId: d.clientId,
    dealId: d.dealId,
    createdAt: d.createdAt.toISOString(),
  }));

  const dealOptions = deals.map((d) => ({ id: d.id, propertyAddress: d.propertyAddress }));

  const formSubmissionDtos: FormSubmissionSummaryDTO[] = formSubmissions.map((s) => ({
    id: s.id,
    templateName: s.formTemplate.name,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    clientId: s.clientId,
    clientName: client.name,
    signers: s.signers
      .map((signer) => ({ id: signer.id, name: signer.name, status: signer.status, order: signer.order }))
      .sort((a, b) => a.order - b.order),
  }));

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
          href="/forms"
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
        <h2 className="mb-6 text-base font-semibold text-foreground">Documents</h2>
        <ClientDocuments clientId={client.id} documents={documentDtos} deals={dealOptions} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Forms</h2>

        {formSubmissionDtos.length > 0 ? (
          <div className="mb-6">
            <ClientFormSubmissions submissions={formSubmissionDtos} />
          </div>
        ) : null}

        <div className="max-w-md border-t border-border pt-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Send a form to sign</h3>
          <SendFormWidget
            clientId={client.id}
            clientName={client.name}
            clientEmail={client.email}
            templates={sendableTemplates}
            deals={dealOptions}
          />
        </div>
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
