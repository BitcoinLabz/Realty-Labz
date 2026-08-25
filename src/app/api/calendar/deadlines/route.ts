import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { buildDeadlineIcs } from "@/lib/calendar-export";
import { dealDisplayName } from "@/app/(app)/transactions/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const deadlines = await prisma.dealDeadline.findMany({
    where: { completedAt: null, deal: teamOrOwnFilter(session.user) },
    include: { deal: { select: { propertyAddress: true } } },
    orderBy: { dueDate: "asc" },
  });

  const ics = buildDeadlineIcs(
    deadlines.map((d) => ({
      label: d.label,
      dueDate: d.dueDate,
      propertyAddress: dealDisplayName(d.deal.propertyAddress),
    })),
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": `attachment; filename="upcoming-deadlines.ics"`,
    },
  });
}
