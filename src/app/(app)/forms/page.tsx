import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ClientForm } from "./client-form";
import { ClientList } from "./client-list";
import { UnfiledDocuments } from "./unfiled-documents";
import type { ClientDTO, ClientOption, DocumentDTO } from "./types";

export default async function ClientsPage() {
  const session = await auth();

  const [clients, unfiledDocuments] = await Promise.all([
    prisma.client.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.document.findMany({
      where: { userId: session!.user.id, clientId: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const dtos: ClientDTO[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    source: c.source,
    stage: c.stage,
  }));

  const clientOptions: ClientOption[] = dtos.map((c) => ({ id: c.id, name: c.name }));

  const unfiledDocumentDtos: DocumentDTO[] = unfiledDocuments.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    clientId: d.clientId,
    dealId: d.dealId,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a client</h2>
        <div className="max-w-md">
          <ClientForm />
        </div>
      </section>

      <ClientList clients={dtos} />

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Unfiled documents</h2>
        <p className="mb-6 text-sm text-muted">
          Documents not yet linked to a client. Most documents belong on a client&apos;s own page —
          use this for anything you haven&apos;t filed yet.
        </p>
        <UnfiledDocuments documents={unfiledDocumentDtos} clients={clientOptions} />
      </section>
    </div>
  );
}
