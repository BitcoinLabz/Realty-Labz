import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, teamOrOwnFilter } from "@/lib/authorization";
import type { DealFileDTO } from "../../deals/types";
import { FilesList } from "./files-list";

export default async function FilesPage() {
  const session = await auth();

  const deals = await prisma.deal.findMany({
    where: teamOrOwnFilter(session!.user),
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      _count: { select: { documents: true, formSubmissions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const files: DealFileDTO[] = deals.map((d) => ({
    id: d.id,
    propertyAddress: d.propertyAddress,
    side: d.side,
    status: d.status,
    clientId: d.client?.id ?? null,
    clientName: d.client?.name ?? null,
    agentName: d.user.name ?? d.user.email,
    documentCount: d._count.documents,
    envelopeCount: d._count.formSubmissions,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Every property across your clients, with the forms and signature requests attached to it.
        </p>
        <Link
          href="/forms/files/new"
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          + Create
        </Link>
      </div>
      <FilesList files={files} showAgentColumn={isManager(session!.user.role)} />
    </div>
  );
}
