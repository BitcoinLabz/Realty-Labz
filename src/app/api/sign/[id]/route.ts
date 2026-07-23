import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/document-storage";

// PUBLIC route (see src/proxy.ts — /sign is deliberately not in the
// protected matcher). id is a FormSubmissionSigner id — the same
// unguessable-cuid-as-bearer-token trust model as /join/[id]. Serves the
// template PDF bytes for pdfjs to render on the public fill/sign page.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const signer = await prisma.formSubmissionSigner.findUnique({
    where: { id },
    include: { formSubmission: { include: { formTemplate: true } } },
  });
  if (!signer) {
    return new NextResponse("Not found", { status: 404 });
  }

  const template = signer.formSubmission.formTemplate;
  const buffer = await readDocumentFile(template.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": template.mimeType,
      "Content-Length": String(template.size),
    },
  });
}
