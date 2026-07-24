import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SignForm } from "./sign-form";
import type { SignFieldDTO } from "./types";

function StatusScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const signer = await prisma.formSubmissionSigner.findUnique({
    where: { id },
    include: {
      formSubmission: {
        include: { formTemplate: true, user: true, signers: { orderBy: { order: "asc" } } },
      },
      templateSigner: { include: { fields: { orderBy: { order: "asc" } } } },
    },
  });

  if (!signer) notFound();

  if (signer.status === "DECLINED" || signer.formSubmission.status === "DECLINED") {
    return (
      <StatusScreen
        title="This document is no longer active"
        body="A signer declined to sign this document. Contact your agent for next steps."
      />
    );
  }

  if (signer.status === "COMPLETED") {
    return (
      <StatusScreen
        title="You're all set"
        body={`You've already completed your part of "${signer.formSubmission.formTemplate.name}."`}
      />
    );
  }

  const earlierIncomplete = signer.formSubmission.signers.find(
    (s) => s.order < signer.order && s.status !== "COMPLETED",
  );
  if (earlierIncomplete) {
    return (
      <StatusScreen
        title="Not your turn yet"
        body={`Waiting on ${earlierIncomplete.name} to complete their part first. You'll get an email as soon as it's your turn.`}
      />
    );
  }

  // Fields may already have a value from send-time auto-fill (client/deal
  // info the agent already had on file) — shown pre-filled but still
  // editable, not locked, so a stale CRM value can be corrected.
  const existingValues = await prisma.formFieldValue.findMany({ where: { signerId: signer.id } });
  const valueByFieldId = new Map(existingValues.map((v) => [v.fieldId, v.value]));

  const fields: SignFieldDTO[] = signer.templateSigner.fields.map((f) => ({
    id: f.id,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    type: f.type,
    label: f.label,
    required: f.required,
    initialValue: valueByFieldId.get(f.id) ?? null,
  }));

  return (
    <SignForm
      signerId={signer.id}
      pdfUrl={`/api/sign/${signer.id}`}
      templateName={signer.formSubmission.formTemplate.name}
      agentName={signer.formSubmission.user.name ?? "Your agent"}
      recipientName={signer.name}
      fields={fields}
    />
  );
}
