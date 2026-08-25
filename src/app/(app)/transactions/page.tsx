import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, teamOrOwnFilter } from "@/lib/authorization";
import { PageHeader } from "@/components/ui/page-header";
import type { DealFileDTO } from "./types";
import { FilesList } from "./transaction-list";

export default async function TransactionsPage() {
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        description="Every property you're working on, with its paperwork, deadlines, and commission in one place."
        action={
          <Link
            href="/transactions/new"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            New transaction
          </Link>
        }
      />
      <FilesList files={files} showAgentColumn={isManager(session!.user.role)} />
    </div>
  );
}
