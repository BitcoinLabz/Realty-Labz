import { Download, FolderOpen, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AddClientButton } from "./add-client-form";
import { ClientList } from "./client-list";
import { UnfiledDocuments } from "./unfiled-documents";
import type { ClientDTO, ClientOption, DocumentDTO } from "./types";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  // /clients?new=1 (the empty state, the dashboard checklist) opens the form.
  const { new: openNew } = await searchParams;

  const [clients, unfiledDocuments] = await Promise.all([
    prisma.client.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.document.findMany({
      where: { userId: session!.user.id, clientId: null, homeOfficeExpense: { is: null } },
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
      <PageHeader
        title="Clients"
        description="The people you're working with — buyers, sellers, renters, and landlords."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AddClientButton defaultOpen={openNew === "1"} />
            {dtos.length > 0 ? (
              <a
                href="/api/clients/export"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
              >
                <Download size={15} />
                Export to CSV
              </a>
            ) : null}
          </div>
        }
      />

      <Card title={`Your clients${dtos.length > 0 ? ` (${dtos.length})` : ""}`} icon={Users}>
        <ClientList clients={dtos} />
      </Card>

      <Card
        title="Documents not filed yet"
        icon={FolderOpen}
        description="Anything you've uploaded that isn't attached to a client yet. Assign one to a client and it moves to their page."
      >
        <UnfiledDocuments documents={unfiledDocumentDtos} clients={clientOptions} />
      </Card>
    </div>
  );
}
