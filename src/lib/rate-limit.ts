import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// Same x-forwarded-for/x-real-ip extraction pattern already used in
// src/app/actions/form-submissions.ts's getRequestInfo.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

// Simple fixed-window counter backed by the shared Postgres (see the
// RateLimitAttempt model comment in schema.prisma for why -- no Redis/
// external service). Returns true if `key` has already hit `max` attempts
// within the last `windowMinutes`; otherwise records this attempt and
// returns false. Old rows for this key are pruned on every call rather than
// via a cron job, so the table never grows unbounded without needing
// external maintenance.
export async function isRateLimited(
  key: string,
  { max, windowMinutes }: { max: number; windowMinutes: number },
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  await prisma.rateLimitAttempt.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

  const count = await prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: windowStart } } });
  if (count >= max) return true;

  await prisma.rateLimitAttempt.create({ data: { key } });
  return false;
}
