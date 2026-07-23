import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/db";
import { readDocumentFile, saveDocumentFile } from "@/lib/document-storage";
import { fieldRectToPdfPoints, fontSizeForFieldHeight } from "@/lib/pdf-fields";

/**
 * Draws every signer's filled-in values onto the original template PDF at
 * their fields' exact positions, appends a certificate-of-completion page
 * (name/email/IP/timestamps per signer — the audit trail behind a
 * legally-binding e-signature), and saves the result as a normal Document
 * linked to the submission's client/deal. Called once the last signer
 * completes (see submitSignerResponseAction in form-submissions.ts).
 */
export async function finalizeFormSubmission(submissionId: string) {
  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      formTemplate: { include: { fields: true } },
      signers: { include: { values: true } },
    },
  });

  const originalBytes = await readDocumentFile(submission.formTemplate.storageKey);
  const pdfDoc = await PDFDocument.load(originalBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Every field belongs to exactly one signer role, so exactly one signer
  // in this submission has a value for it — flatten to a single lookup.
  const valueByFieldId = new Map<string, string>();
  for (const signer of submission.signers) {
    for (const value of signer.values) {
      valueByFieldId.set(value.fieldId, value.value);
    }
  }

  for (const field of submission.formTemplate.fields) {
    // field.page is stored 0-indexed, matching pdf-lib's getPages() array —
    // pdfjs-dist's getPage() is 1-indexed, so the designer/fill UI add 1
    // when calling into pdfjs. Keep that conversion in exactly those two
    // places, not here.
    const page = pages[field.page];
    const value = valueByFieldId.get(field.id);
    if (!page || value === undefined) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const rect = fieldRectToPdfPoints(field, pageWidth, pageHeight);

    if (field.type === "SIGNATURE" || field.type === "INITIALS") {
      if (!value) continue;
      const image = await pdfDoc.embedPng(value);
      const scaled = image.scaleToFit(rect.width, rect.height);
      page.drawImage(image, {
        x: rect.x + (rect.width - scaled.width) / 2,
        y: rect.y + (rect.height - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
    } else if (field.type === "CHECKBOX") {
      if (value === "true") {
        page.drawText("X", {
          x: rect.x + rect.width * 0.2,
          y: rect.y + rect.height * 0.2,
          size: fontSizeForFieldHeight(rect.height),
          font: boldFont,
        });
      }
    } else {
      page.drawText(value, {
        x: rect.x + 2,
        y: rect.y + rect.height * 0.25,
        size: fontSizeForFieldHeight(rect.height),
        font,
        maxWidth: Math.max(rect.width - 4, 1),
      });
    }
  }

  const cert = pdfDoc.addPage();
  const { height: certHeight } = cert.getSize();
  let cursorY = certHeight - 60;
  cert.drawText("Certificate of Completion", { x: 50, y: cursorY, size: 18, font: boldFont });
  cursorY -= 26;
  cert.drawText(submission.formTemplate.name, { x: 50, y: cursorY, size: 12, font });
  cursorY -= 30;

  for (const signer of submission.signers) {
    cert.drawText(`${signer.name} <${signer.email}>`, { x: 50, y: cursorY, size: 11, font: boldFont });
    cursorY -= 16;
    cert.drawText(`Consent given: ${signer.consentGivenAt?.toISOString() ?? "-"}`, {
      x: 60,
      y: cursorY,
      size: 10,
      font,
    });
    cursorY -= 14;
    cert.drawText(`Signed: ${signer.completedAt?.toISOString() ?? "-"}`, {
      x: 60,
      y: cursorY,
      size: 10,
      font,
    });
    cursorY -= 14;
    cert.drawText(`IP address: ${signer.ipAddress ?? "-"}`, { x: 60, y: cursorY, size: 10, font });
    cursorY -= 14;
    cert.drawText(`User agent: ${(signer.userAgent ?? "-").slice(0, 90)}`, {
      x: 60,
      y: cursorY,
      size: 8,
      font,
    });
    cursorY -= 26;
  }

  const finalBytes = await pdfDoc.save();
  const safeName = submission.formTemplate.name.replace(/[^\w\- ]+/g, "").trim() || "document";
  const fileName = `${safeName} (signed).pdf`;
  const file = new File([new Uint8Array(finalBytes)], fileName, { type: "application/pdf" });
  const storageKey = await saveDocumentFile(submission.userId, file);

  return {
    storageKey,
    fileName,
    mimeType: "application/pdf",
    size: finalBytes.byteLength,
  };
}
