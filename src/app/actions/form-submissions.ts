"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter, teamSharedFilter } from "@/lib/authorization";
import {
  sendCompletedDocumentEmail,
  sendDeclinedNotificationEmail,
  sendSigningRequestEmail,
} from "@/lib/email";
import { readDocumentFile } from "@/lib/document-storage";
import { finalizeFormSubmission } from "@/lib/pdf-finalize";
import { formSignerSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";
import type { Client, Deal } from "@/generated/prisma/client";
import type { FormFieldAutoFillSource } from "@/generated/prisma/enums";

// Resolves a field's bound value from the submission's linked client/deal —
// direct founder request (2026-07-24): an agent shouldn't make a client
// retype info the CRM already has. Missing source data (e.g. a deal field
// with no deal linked) just leaves the field blank, no error — it's still
// editable by hand either way.
function resolveAutoFillValue(
  source: FormFieldAutoFillSource,
  client: Client | null,
  deal: Deal | null,
): string | null {
  switch (source) {
    case "CLIENT_NAME":
      return client?.name ?? null;
    case "CLIENT_EMAIL":
      return client?.email ?? null;
    case "CLIENT_PHONE":
      return client?.phone ?? null;
    case "DEAL_PROPERTY_ADDRESS":
      return deal?.propertyAddress ?? null;
    case "DEAL_MLS_NUMBER":
      return deal?.mlsNumber ?? null;
    case "DEAL_LIST_PRICE":
      return deal?.listPrice ? deal.listPrice.toString() : null;
    case "DEAL_SALE_PRICE":
      return deal?.salePrice ? deal.salePrice.toString() : null;
    case "DEAL_CLOSING_DATE":
      return deal?.closingDate ? deal.closingDate.toISOString().slice(0, 10) : null;
    default:
      return null;
  }
}

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function getRequestInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function sendFormSubmissionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const formTemplateId = formData.get("formTemplateId");
  if (typeof formTemplateId !== "string" || !formTemplateId) {
    return { error: "Choose a template" };
  }

  const template = await prisma.formTemplate.findFirst({
    where: { id: formTemplateId, ...teamSharedFilter(session.user) },
    include: { signers: { orderBy: { order: "asc" } }, fields: true },
  });
  if (!template) return { error: "Template not found" };
  if (template.fields.length === 0) {
    return { error: "This template has no fields yet — add fields to it before sending" };
  }

  const clientIdRaw = formData.get("clientId");
  const dealIdRaw = formData.get("dealId");
  const clientId = typeof clientIdRaw === "string" && clientIdRaw ? clientIdRaw : null;
  const dealId = typeof dealIdRaw === "string" && dealIdRaw ? dealIdRaw : null;
  const keepForRecords = formData.get("keepForRecords") === "true";

  let client: Client | null = null;
  if (clientId) {
    // Clients aren't team-shared yet (see CLAUDE.md) — plain userId check.
    client = await prisma.client.findFirst({ where: { id: clientId, userId: session.user.id } });
    if (!client) return { error: "Client not found" };
  }
  let deal: Deal | null = null;
  if (dealId) {
    deal = await prisma.deal.findFirst({ where: { id: dealId, ...teamOrOwnFilter(session.user) } });
    if (!deal) return { error: "Deal not found" };
  }

  // "Keep for my own records" (2026-07-24, direct founder request): the
  // agent fills it out and signs it themselves right away — no client
  // signature needed. Only makes sense for a single-signer template; a
  // lease needing tenant+landlord genuinely needs two real people.
  if (keepForRecords && template.signers.length !== 1) {
    return { error: "Keeping a form for your own records only works for single-signer templates" };
  }

  const signerInputs: { templateSignerId: string; order: number; name: string; email: string }[] = [];
  if (keepForRecords) {
    if (!session.user.email) return { error: "Your account is missing an email address" };
    const onlySigner = template.signers[0];
    signerInputs.push({
      templateSignerId: onlySigner.id,
      order: onlySigner.order,
      name: session.user.name ?? "Me",
      email: session.user.email,
    });
  } else {
    for (const signer of template.signers) {
      const result = formSignerSchema.safeParse({
        name: formData.get(`name_${signer.id}`),
        email: formData.get(`email_${signer.id}`),
      });
      if (!result.success) {
        const issues = result.error.issues;
        const nameIssue = issues.find((i) => i.path[0] === "name");
        const emailIssue = issues.find((i) => i.path[0] === "email");
        return {
          fieldErrors: {
            ...(nameIssue ? { [`name_${signer.id}`]: `${nameIssue.message} for ${signer.label}` } : {}),
            ...(emailIssue ? { [`email_${signer.id}`]: `${emailIssue.message} for ${signer.label}` } : {}),
          },
        };
      }
      signerInputs.push({
        templateSignerId: signer.id,
        order: signer.order,
        name: result.data.name,
        email: result.data.email,
      });
    }
  }

  const submission = await prisma.formSubmission.create({
    data: {
      formTemplateId: template.id,
      userId: session.user.id,
      clientId,
      dealId,
      signers: { create: signerInputs },
    },
    include: { signers: { orderBy: { order: "asc" } } },
  });

  // Pre-fill every field bound to a client/deal property — before the
  // signer (or the agent, in keep-for-records mode) ever opens the link.
  const autoFillFields = template.fields.filter((f) => f.autoFillSource);
  if (autoFillFields.length > 0) {
    const signerByTemplateSignerId = new Map(submission.signers.map((s) => [s.templateSignerId, s]));
    const autoFillValues: { fieldId: string; value: string; signerId: string }[] = [];
    for (const field of autoFillFields) {
      const submissionSigner = signerByTemplateSignerId.get(field.signerId);
      if (!submissionSigner || !field.autoFillSource) continue;
      const value = resolveAutoFillValue(field.autoFillSource, client, deal);
      if (value) autoFillValues.push({ fieldId: field.id, value, signerId: submissionSigner.id });
    }
    if (autoFillValues.length > 0) {
      await prisma.formFieldValue.createMany({ data: autoFillValues });
    }
  }

  const firstSigner = submission.signers[0];

  if (keepForRecords) {
    if (clientId) revalidatePath(`/forms/${clientId}`);
    revalidatePath("/forms/templates");
    redirect(`/sign/${firstSigner.id}`);
  }

  if (firstSigner) {
    const baseUrl = await getBaseUrl();
    try {
      await sendSigningRequestEmail({
        to: firstSigner.email,
        recipientName: firstSigner.name,
        senderName: session.user.name ?? "Your agent",
        templateName: template.name,
        signUrl: `${baseUrl}/sign/${firstSigner.id}`,
      });
    } catch (err) {
      // Email delivery isn't configured yet, or failed — the submission
      // (and its signable link) still exists; the agent can copy the link
      // manually from the submission list, same fallback TeamInvite uses.
      // Logged (not swallowed silently) so a Resend outage/misconfig is
      // actually visible in Vercel's function logs.
      console.error("[form-submissions] sendSigningRequestEmail failed", {
        submissionId: submission.id,
        signerId: firstSigner.id,
        err,
      });
    }
  }

  if (clientId) revalidatePath(`/forms/${clientId}`);
  revalidatePath("/forms/templates");
  return {};
}

export async function submitSignerResponseAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const signerId = formData.get("signerId");
  if (typeof signerId !== "string" || !signerId) return { error: "Missing signer" };

  const signer = await prisma.formSubmissionSigner.findUnique({
    where: { id: signerId },
    include: {
      formSubmission: {
        include: { formTemplate: true, user: true, signers: { orderBy: { order: "asc" } } },
      },
      templateSigner: { include: { fields: true } },
    },
  });
  if (!signer) return { error: "This link is invalid" };
  if (signer.status === "COMPLETED") return { error: "You've already completed this document" };
  if (signer.status === "DECLINED" || signer.formSubmission.status === "DECLINED") {
    return { error: "This document was declined and is no longer active" };
  }

  const earlierIncomplete = signer.formSubmission.signers.find(
    (s) => s.order < signer.order && s.status !== "COMPLETED",
  );
  if (earlierIncomplete) {
    return { error: `Waiting on ${earlierIncomplete.name} to complete their part first` };
  }

  if (formData.get("consent") !== "true") {
    return { error: "You must agree to sign electronically before continuing" };
  }

  const values: { fieldId: string; value: string }[] = [];
  for (const field of signer.templateSigner.fields) {
    const raw = formData.get(`field_${field.id}`);
    const value = typeof raw === "string" ? raw : field.type === "CHECKBOX" ? "false" : "";
    const isEmpty = field.type === "CHECKBOX" ? value !== "true" : !value;
    if (field.required && isEmpty) {
      return { fieldErrors: { [`field_${field.id}`]: `${field.label} is required` } };
    }
    values.push({ fieldId: field.id, value });
  }

  const { ip, userAgent } = await getRequestInfo();
  const now = new Date();

  await prisma.$transaction([
    prisma.formFieldValue.deleteMany({ where: { signerId: signer.id } }),
    prisma.formFieldValue.createMany({ data: values.map((v) => ({ ...v, signerId: signer.id })) }),
    prisma.formSubmissionSigner.update({
      where: { id: signer.id },
      data: { status: "COMPLETED", completedAt: now, consentGivenAt: now, ipAddress: ip, userAgent },
    }),
  ]);

  const nextSigner = signer.formSubmission.signers.find((s) => s.order === signer.order + 1);

  if (nextSigner) {
    await prisma.formSubmission.update({
      where: { id: signer.formSubmission.id },
      data: { status: "IN_PROGRESS" },
    });
    const baseUrl = await getBaseUrl();
    try {
      await sendSigningRequestEmail({
        to: nextSigner.email,
        recipientName: nextSigner.name,
        senderName: signer.formSubmission.user.name ?? "Your agent",
        templateName: signer.formSubmission.formTemplate.name,
        signUrl: `${baseUrl}/sign/${nextSigner.id}`,
      });
    } catch (err) {
      // Same fallback as above — the link still exists even if delivery fails.
      console.error("[form-submissions] sendSigningRequestEmail (next signer) failed", {
        submissionId: signer.formSubmission.id,
        signerId: nextSigner.id,
        err,
      });
    }
  } else {
    const finalized = await finalizeFormSubmission(signer.formSubmission.id);
    const document = await prisma.document.create({
      data: {
        userId: signer.formSubmission.userId,
        clientId: signer.formSubmission.clientId,
        dealId: signer.formSubmission.dealId,
        fileName: finalized.fileName,
        storageKey: finalized.storageKey,
        mimeType: finalized.mimeType,
        size: finalized.size,
      },
    });
    await prisma.formSubmission.update({
      where: { id: signer.formSubmission.id },
      data: { status: "COMPLETED", completedAt: now, completedDocumentId: document.id },
    });

    try {
      const pdfBuffer = await readDocumentFile(finalized.storageKey);
      const allSigners = await prisma.formSubmissionSigner.findMany({
        where: { formSubmissionId: signer.formSubmission.id },
      });
      await sendCompletedDocumentEmail({
        to: allSigners.map((s) => s.email),
        templateName: signer.formSubmission.formTemplate.name,
        pdfBuffer,
        fileName: finalized.fileName,
      });
    } catch (err) {
      // Completed document is already saved as a real Document regardless —
      // this is just the courtesy copy failing to send.
      console.error("[form-submissions] sendCompletedDocumentEmail failed", {
        submissionId: signer.formSubmission.id,
        err,
      });
    }
  }

  revalidatePath(`/sign/${signerId}`);
  return {};
}

export async function markSignerViewedAction(signerId: string) {
  await prisma.formSubmissionSigner.updateMany({
    where: { id: signerId, status: "PENDING" },
    data: { status: "VIEWED", viewedAt: new Date() },
  });
}

export async function declineSignerAction(formData: FormData) {
  const signerId = formData.get("signerId");
  if (typeof signerId !== "string" || !signerId) return;

  const signer = await prisma.formSubmissionSigner.findUnique({
    where: { id: signerId },
    include: { formSubmission: { include: { user: true, formTemplate: true } } },
  });
  if (!signer || signer.status === "COMPLETED" || signer.status === "DECLINED") return;

  await prisma.$transaction([
    prisma.formSubmissionSigner.update({ where: { id: signerId }, data: { status: "DECLINED" } }),
    prisma.formSubmission.update({
      where: { id: signer.formSubmissionId },
      data: { status: "DECLINED" },
    }),
  ]);

  try {
    await sendDeclinedNotificationEmail({
      to: signer.formSubmission.user.email,
      signerName: signer.name,
      templateName: signer.formSubmission.formTemplate.name,
    });
  } catch (err) {
    // Non-critical — the decline itself is already recorded.
    console.error("[form-submissions] sendDeclinedNotificationEmail failed", {
      signerId: signer.id,
      err,
    });
  }

  revalidatePath(`/sign/${signerId}`);
}
