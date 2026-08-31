import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/document-storage";
import { documentReadFilter } from "@/lib/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  // Your own documents, plus -- for a manager -- anything attached to a
  // transaction they can see, so a broker can pull the contracts they're
  // accountable for. Client-only and unfiled documents stay owner-only; see
  // documentReadFilter for why that line is drawn through the deal.
  const doc = await prisma.document.findFirst({
    where: { id, ...documentReadFilter(session.user) },
  });
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readDocumentFile(doc.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "Content-Length": String(doc.size),
    },
  });
}
