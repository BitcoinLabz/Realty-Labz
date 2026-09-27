import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamSharedFilter } from "@/lib/authorization";
import { PageHeader } from "@/components/ui/page-header";
import { TransactionsTabs } from "../section-tabs";
import { LibraryList } from "./library-list";
import type { DocumentTemplateDTO } from "./types";

export default async function LibraryPage() {
  const session = await auth();

  const documentTemplates = await prisma.documentTemplate.findMany({
    where: teamSharedFilter(session!.user),
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  const documentTemplateDtos: DocumentTemplateDTO[] = documentTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    fileName: t.fileName,
    mimeType: t.mimeType,
    size: t.size,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.user.name ?? t.user.email,
  }));

  const canManage = canManageSharedResources(session!.user);
  const isTeamShared = !!session!.user.teamId;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Transactions" description="Every property you're working on, with its paperwork, deadlines, and commission in one place." />
      <TransactionsTabs />
      <LibraryList templates={documentTemplateDtos} canManage={canManage} isTeamShared={isTeamShared} />
    </div>
  );
}
