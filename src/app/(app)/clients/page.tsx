import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamSharedFilter } from "@/lib/authorization";
import { ClientForm } from "./client-form";
import { ClientList } from "./client-list";
import { UnfiledDocuments } from "./unfiled-documents";
import { SharedTemplates } from "./shared-templates";
import type { ClientDTO, ClientOption, DocumentDTO, DocumentTemplateDTO } from "./types";

export default async function ClientsPage() {
  const session = await auth();

  const [clients, unfiledDocuments, templates] = await Promise.all([
    prisma.client.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.document.findMany({
      where: { userId: session!.user.id, clientId: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documentTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const dtos: ClientDTO[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
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

  const templateDtos: DocumentTemplateDTO[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    fileName: t.fileName,
    size: t.size,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.user.name ?? t.user.email,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted">Keep track of who you're working with.</p>
      </div>

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

      <SharedTemplates
        templates={templateDtos}
        canManage={canManageSharedResources(session!.user)}
        isTeamShared={!!session!.user.teamId}
      />
    </div>
  );
}
