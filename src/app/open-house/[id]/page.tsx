import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/ui/logo";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import { VisitorForm } from "./visitor-form";

// Public and unauthenticated by design (same trust model as /sign/[id]) --
// but there's no reason for it to show up in a search result, and the
// address in the title would be the thing indexed.
export const metadata: Metadata = {
  title: "Open house sign-in",
  robots: { index: false, follow: false },
};

function formatTime(value: string) {
  // Stored as "HH:MM" -- shown to a visitor as "1:00 PM".
  const [hourStr, minute] = value.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export default async function OpenHousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const openHouse = await prisma.openHouse.findUnique({
    where: { id },
    include: { deal: { select: { propertyAddress: true } } },
  });

  if (!openHouse) notFound();

  // Stored as a date-only value; re-anchored at local midnight so it can't
  // read back a day early in a timezone behind UTC.
  const dateLabel = new Date(
    openHouse.date.toISOString().slice(0, 10) + "T00:00:00",
  ).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Welcome — please sign in</h1>
            <p className="mt-1 text-sm font-medium text-foreground">
              {dealDisplayName(openHouse.deal.propertyAddress)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {dateLabel} ·
              {formatTime(openHouse.startTime)} – {formatTime(openHouse.endTime)}
            </p>
          </div>
        </div>
        <VisitorForm openHouseId={openHouse.id} />
      </div>
    </div>
  );
}
