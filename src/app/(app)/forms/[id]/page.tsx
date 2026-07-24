import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamSharedFilter } from "@/lib/authorization";
import { SignerManager } from "./signer-manager";
import { FieldDesigner } from "./field-designer";
import type { TemplateFieldDTO, TemplateSignerDTO } from "../types";

export default async function FormTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const template = await prisma.formTemplate.findFirst({
    where: { id, ...teamSharedFilter(session!.user) },
    include: {
      signers: { orderBy: { order: "asc" } },
      fields: { orderBy: { order: "asc" } },
      _count: { select: { submissions: true } },
    },
  });
  if (!template) notFound();

  const canManage = canManageSharedResources(session!.user);
  const hasSubmissions = template._count.submissions > 0;
  const editable = canManage && !hasSubmissions;

  const signerDtos: TemplateSignerDTO[] = template.signers.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
  }));
  const fieldDtos: TemplateFieldDTO[] = template.fields.map((f) => ({
    id: f.id,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    type: f.type,
    label: f.label,
    required: f.required,
    order: f.order,
    signerId: f.signerId,
    autoFillSource: f.autoFillSource,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/forms"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Forms
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{template.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {hasSubmissions
            ? "This template has already been sent — its signers and fields can no longer be changed. Create a new template to make changes."
            : "Define who needs to sign and place fields on the PDF below."}
        </p>
      </div>

      {!hasSubmissions && canManage ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-4 text-base font-semibold text-foreground">Signers</h2>
          <div className="max-w-sm">
            <SignerManager templateId={template.id} signers={signerDtos} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-4 text-base font-semibold text-foreground">Fields</h2>
        {editable ? (
          <FieldDesigner
            templateId={template.id}
            pdfUrl={`/api/form-templates/${template.id}`}
            signers={signerDtos}
            initialFields={fieldDtos}
          />
        ) : (
          <p className="text-sm text-muted">
            {fieldDtos.length} field{fieldDtos.length === 1 ? "" : "s"} across{" "}
            {new Set(fieldDtos.map((f) => f.page)).size || 1} page
            {new Set(fieldDtos.map((f) => f.page)).size === 1 ? "" : "s"}, for {signerDtos.length} signer
            {signerDtos.length === 1 ? "" : "s"}.
          </p>
        )}
      </section>
    </div>
  );
}
