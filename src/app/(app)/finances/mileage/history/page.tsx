import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { MileageHistory } from "./mileage-history";
import type { MileageLogDTO } from "../types";

export default async function MileageHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const { year: yearParam } = await searchParams;

  const mileageLogs = await prisma.mileageLog.findMany({
    where: { userId: session!.user.id },
    orderBy: { date: "desc" },
  });

  const dtos: MileageLogDTO[] = mileageLogs.map((log) => ({
    id: log.id,
    date: log.date.toISOString().slice(0, 10),
    miles: Number(log.miles),
    isBusiness: log.isBusiness,
    note: log.note,
    ratePerMile: Number(log.ratePerMile),
    deduction: Number(log.deduction),
  }));

  const years = Array.from(new Set(dtos.map((l) => l.date.slice(0, 4)))).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/finances/mileage"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Mileage
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">All trips</h1>
        <p className="mt-1 text-sm text-muted">
          Every trip you&apos;ve ever logged, searchable and filterable.
        </p>
      </div>

      <MileageHistory logs={dtos} years={years} initialYear={yearParam ?? ""} />
    </div>
  );
}
