import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamSharedFilter } from "@/lib/authorization";
import { readDocumentFile } from "@/lib/document-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...teamSharedFilter(session.user) },
  });
  if (!template) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readDocumentFile(template.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": template.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(template.fileName)}"`,
      "Content-Length": String(template.size),
    },
  });
}
