import { randomUUID } from "node:crypto";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/supabase";

// Files live in a private Supabase Storage bucket (not publicly readable) and
// are only ever served through the authenticated route handler at
// /api/documents/[id] — see scripts/supabase-setup.mjs for bucket creation.
const BUCKET = "documents";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// Magic-byte signatures for every type ALLOWED_MIME_TYPES/
// FORM_TEMPLATE_ALLOWED_MIME_TYPES accepts — checked against the file's
// actual bytes, not the client-supplied `file.type` header (trivially
// spoofable). This is defense-in-depth for the PDF-rendering CVE surface:
// pdfjs-dist renders these bytes client-side on the public /sign/[id] page,
// so a mislabeled malicious file must never reach it.
const FILE_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  // .docx (zip container)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) =>
    b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  // legacy .doc (OLE compound file)
  "application/msword": (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
};

function verifyFileSignature(buffer: Buffer, declaredMimeType: string): boolean {
  const check = FILE_SIGNATURES[declaredMimeType];
  return check ? check(buffer) : false;
}

export async function saveDocumentFile(userId: string, file: File): Promise<string> {
  const ext = path.extname(file.name);
  const storageKey = `${userId}/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!verifyFileSignature(buffer, file.type)) {
    throw new Error("This file's content doesn't match its declared type");
  }

  const { error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .upload(storageKey, buffer, { contentType: file.type });

  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  return storageKey;
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(storageKey);
  if (error || !data) {
    throw new Error(`Failed to read document: ${error?.message ?? "not found"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  await getSupabaseAdmin().storage.from(BUCKET).remove([storageKey]);
}
