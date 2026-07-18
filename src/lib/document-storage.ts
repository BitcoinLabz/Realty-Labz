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

export async function saveDocumentFile(userId: string, file: File): Promise<string> {
  const ext = path.extname(file.name);
  const storageKey = `${userId}/${randomUUID()}${ext}`;

  const { error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .upload(storageKey, file, { contentType: file.type });

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
