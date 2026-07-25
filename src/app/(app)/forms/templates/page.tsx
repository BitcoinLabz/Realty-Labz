import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamOrOwnFilter, teamSharedFilter } from "@/lib/authorization";
import { UploadTemplateForm } from "./upload-template-form";
import { TemplateList } from "./template-list";
import { SubmissionList } from "./submission-list";
import { SharedTemplates } from "./shared-templates";
import type { DocumentTemplateDTO, FormSubmissionSummaryDTO, FormTemplateDTO } from "./types";

export default async function TemplatesPage() {
  const session = await auth();

  const [templates, submissions, documentTemplates] = await Promise.all([
    prisma.formTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: {
        user: true,
        _count: { select: { signers: true, fields: true, submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formSubmission.findMany({
      where: teamOrOwnFilter(session!.user),
      include: { formTemplate: true, client: true, signers: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.documentTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const templateDtos: FormTemplateDTO[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    fileName: t.fileName,
    size: t.size,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.user.name ?? t.user.email,
    signerCount: t._count.signers,
    fieldCount: t._count.fields,
    hasSubmissions: t._count.submissions > 0,
  }));

  const submissionDtos: FormSubmissionSummaryDTO[] = submissions.map((s) => ({
    id: s.id,
    templateName: s.formTemplate.name,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    clientId: s.clientId,
    clientName: s.client?.name ?? null,
    signers: s.signers
      .map((signer) => ({ id: signer.id, name: signer.name, status: signer.status, order: signer.order }))
      .sort((a, b) => a.order - b.order),
  }));

  const documentTemplateDtos: DocumentTemplateDTO[] = documentTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    fileName: t.fileName,
    size: t.size,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.user.name ?? t.user.email,
  }));

  const canManage = canManageSharedResources(session!.user);
  const isTeamShared = !!session!.user.teamId;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {isTeamShared ? "Team form library" : "Form library"}
        </h2>
        <p className="mb-6 text-sm text-muted">
          {isTeamShared
            ? "Contract templates shared with your whole team — place fields once, send to any client."
            : "Contract templates you reuse across clients."}
        </p>

        {canManage ? (
          <div className="mb-6 max-w-md border-b border-border pb-6">
            <UploadTemplateForm />
          </div>
        ) : null}

        <TemplateList templates={templateDtos} canManage={canManage} isTeamShared={isTeamShared} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Recent activity</h2>
        <SubmissionList submissions={submissionDtos} />
      </section>

      <SharedTemplates
        templates={documentTemplateDtos}
        canManage={canManage}
        isTeamShared={isTeamShared}
      />
    </div>
  );
}
