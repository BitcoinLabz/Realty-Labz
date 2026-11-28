import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { clientsToCsv } from "@/lib/client-csv";
import { isRateLimited } from "@/lib/rate-limit";

// Every client the signed-in agent owns, as one CSV (2026-11-28). Scoped by
// plain userId: clients are never team-visible, not even to a broker.
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  if (await isRateLimited(`clients-export:${session.user.id}`, { max: 30, windowMinutes: 60 })) {
    return new NextResponse("Too many requests — please wait a few minutes and try again.", { status: 429 });
  }

  const clients = await prisma.client.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: {
      name: true,
      email: true,
      phone: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      source: true,
      stage: true,
      notes: true,
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(clientsToCsv(clients), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realty-labz-clients-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
