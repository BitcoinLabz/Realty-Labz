import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

// Local disk storage for dev. Files live outside `public/` so they can only be
// served through the authenticated route handler at /api/documents/[id].
// This does NOT persist on Vercel's serverless functions — swap for a cloud
// storage provider (e.g. Vercel Blob) before deploying. See CLAUDE.md.
const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function resolveStoragePath(storageKey: string): string {
  const resolved = path.join(STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export async function saveDocumentFile(userId: string, file: File): Promise<string> {
  const ext = path.extname(file.name);
  const storageKey = path.posix.join(userId, `${randomUUID()}${ext}`);
  const destPath = resolveStoragePath(storageKey);

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destPath, buffer);

  return storageKey;
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storageKey));
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  await fs.rm(resolveStoragePath(storageKey), { force: true });
}
