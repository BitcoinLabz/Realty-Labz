import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { DocumentUploadForm } from "./document-upload-form";
import { DocumentList } from "./document-list";
import type { DocumentDTO } from "./types";

export default async function DocumentsPage() {
  const session = await auth();

  const [documents, clients, deals] = await Promise.all([
    prisma.document.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.deal.findMany({
      where: teamOrOwnFilter(session!.user),
      orderBy: { propertyAddress: "asc" },
      select: { id: true, propertyAddress: true },
    }),
  ]);

  const dtos: DocumentDTO[] = documents.map((d) => ({
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted">Store contracts and paperwork per client or deal.</p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Upload a document</h2>
        <div className="max-w-md">
          <DocumentUploadForm clients={clients} deals={deals} />
        </div>
      </section>

      <DocumentList documents={dtos} clients={clients} deals={deals} />
    </div>
  );
}
