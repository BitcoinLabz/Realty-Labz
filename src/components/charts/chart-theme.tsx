"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

// Shared chart chrome so every graph uses the same ticks, tooltip, and motion.
export function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    const n = abs / 1_000_000;
    return `${sign}$${n >= 10 ? Math.round(n) : trimOne(n)}m`;
  }
  if (abs >= 1_000) {
    const n = abs / 1_000;
    return `${sign}$${n >= 10 ? Math.round(n) : trimOne(n)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

function trimOne(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function useChartMotion(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setOn(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return on;
}

export const axisTick = { fill: "var(--muted)", fontSize: 11 };
export const chartCursor = { fill: "var(--foreground)", fillOpacity: 0.04 };
export const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 };

type TipRow = { name?: string; value?: number | string; color?: string };

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: TipRow[];
  label?: string | number;
  formatValue?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
      {label != null && label !== "" ? (
        <p className="mb-1 text-[11px] font-medium tracking-wide text-muted">{label}</p>
      ) : null}
      <div className="flex flex-col gap-1">
        {payload.map((row) => (
          <p key={String(row.name)} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color }} />
              {row.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {formatValue ? formatValue(Number(row.value), row.name) : formatCurrency(Number(row.value))}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
