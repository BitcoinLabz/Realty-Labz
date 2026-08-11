import { Resend } from "resend";

let client: Resend | undefined;

// Lazy singleton, same pattern as getSupabaseAdmin() in src/lib/supabase.ts —
// constructed on first use so the app still builds/runs with these env vars
// unset; only the actual send call fails until RESEND_API_KEY/
// RESEND_FROM_EMAIL are configured (see CLAUDE.md for the Resend account +
// Cloudflare domain-verification setup this needs).
function getResendClient() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(apiKey);
  }
  return client;
}

function getFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");
  return from;
}

// Every string interpolated into an HTML email body below can originate from
// user input (a signer's typed name, a template name, a contact form
// message) — escape it so an agent or public visitor can't inject markup/
// links into an email sent to someone else.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendSigningRequestEmail(params: {
  to: string;
  recipientName: string;
  senderName: string;
  templateName: string;
  signUrl: string;
}) {
  const resend = getResendClient();
  await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: `${params.senderName} sent you "${params.templateName}" to review and sign`,
    html: `
      <p>Hi ${escapeHtml(params.recipientName)},</p>
      <p>${escapeHtml(params.senderName)} has sent you <strong>${escapeHtml(params.templateName)}</strong> to review and sign.</p>
      <p><a href="${params.signUrl}">Review &amp; sign</a></p>
      <p style="color:#86868b;font-size:13px;">This link is unique to you — please don't forward it.</p>
    `,
  });
}

export async function sendCompletedDocumentEmail(params: {
  to: string[];
  templateName: string;
  pdfBuffer: Buffer;
  fileName: string;
}) {
  const resend = getResendClient();
  await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: `${params.templateName} — fully signed`,
    html: `
      <p>Every signer has completed <strong>${escapeHtml(params.templateName)}</strong>.</p>
      <p>The fully signed document is attached.</p>
    `,
    attachments: [
      {
        filename: params.fileName,
        content: params.pdfBuffer,
      },
    ],
  });
}

export async function sendPortalAccessEmail(params: {
  to: string;
  clientName: string;
  senderName: string;
  portalUrl: string;
}) {
  const resend = getResendClient();
  await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: `${params.senderName} shared a link to your deal and document status`,
    html: `
      <p>Hi ${escapeHtml(params.clientName)},</p>
      <p>${escapeHtml(params.senderName)} has given you access to a private page where you can see your deal status and documents.</p>
      <p><a href="${params.portalUrl}">View your deal status</a></p>
      <p style="color:#86868b;font-size:13px;">This link is unique to you — please don't forward it. It stays valid for 30 days.</p>
    `,
  });
}

// Reuses RESEND_FROM_EMAIL as the destination too (send-to-self), so this
// needs zero new env var configuration — if that inbox isn't actually
// monitored, point this at a dedicated address later instead.
export async function sendContactFormEmail(params: { name: string; email: string; message: string }) {
  const resend = getResendClient();
  const to = process.env.RESEND_FROM_EMAIL;
  if (!to) throw new Error("RESEND_FROM_EMAIL is not set");
  await resend.emails.send({
    from: getFromAddress(),
    to,
    replyTo: params.email,
    subject: `New Support message from ${params.name}`,
    html: `
      <p><strong>From:</strong> ${escapeHtml(params.name)} (${escapeHtml(params.email)})</p>
      <p style="white-space:pre-wrap;">${escapeHtml(params.message)}</p>
    `,
  });
}

export async function sendDeclinedNotificationEmail(params: {
  to: string;
  signerName: string;
  templateName: string;
}) {
  const resend = getResendClient();
  await resend.emails.send({
    from: getFromAddress(),
    to: params.to,
    subject: `${params.signerName} declined to sign "${params.templateName}"`,
    html: `<p>${escapeHtml(params.signerName)} declined to sign <strong>${escapeHtml(params.templateName)}</strong>.</p>`,
  });
}
