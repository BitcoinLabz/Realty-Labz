import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { buildDeadlineIcs } from "@/lib/calendar-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id, ...teamOrOwnFilter(session.user) },
    include: { deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" } } },
  });
  if (!deal) return new NextResponse("Not found", { status: 404 });

  const ics = buildDeadlineIcs(
    deal.deadlines.map((d) => ({ label: d.label, dueDate: d.dueDate, propertyAddress: deal.propertyAddress })),
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": `attachment; filename="${deal.propertyAddress.replace(/[^a-z0-9]/gi, "-")}-deadlines.ics"`,
    },
  });
}
