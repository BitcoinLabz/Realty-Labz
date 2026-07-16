"use client";

import { useRouter } from "next/navigation";

export function YearSelect({ year, options }: { year: number; options: number[] }) {
  const router = useRouter();

  return (
    <select
      value={year}
      onChange={(e) => router.push(`/transactions?year=${e.target.value}`)}
      className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
    >
      {options.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
