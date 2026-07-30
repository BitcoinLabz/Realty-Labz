import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/document-storage";
import { resolvePortalClientId } from "@/lib/client-portal";

// Portal-scoped document download -- deliberately NOT a reuse of
// /api/documents/[id], which is built for agent sessions. clientId is
// resolved from the portal session cookie server-side (never from this
// route's own [id] param), then the document's OWN clientId is checked
// against it -- the same "verify the parent, cross-check the child" pattern
// whose absence caused the two IDOR bugs fixed elsewhere in this audit pass.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await resolvePortalClientId();
  if (!clientId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, clientId } });
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
