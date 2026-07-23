import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamSharedFilter } from "@/lib/authorization";
import { readDocumentFile } from "@/lib/document-storage";

// Serves the template's raw PDF bytes for pdfjs to render in the designer —
// deliberately no Content-Disposition: attachment (this isn't a download
// link, it's fetched programmatically and rendered to <canvas>).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const template = await prisma.formTemplate.findFirst({
    where: { id, ...teamSharedFilter(session.user) },
  });
  if (!template) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readDocumentFile(template.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": template.mimeType,
      "Content-Length": String(template.size),
    },
  });
}
