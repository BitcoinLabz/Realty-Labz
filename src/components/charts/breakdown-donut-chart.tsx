"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/format";
import { useChartMotion } from "./chart-theme";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function BreakdownDonutChart({ data }: { data: { label: string; value: number }[] }) {
  const motion = useChartMotion();
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shown = active == null ? total : data[active]?.value ?? total;
  const shownLabel = active == null ? "Total" : data[active]?.label ?? "Total";

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative h-[188px] w-[188px] shrink-0">
        <ResponsiveContainer width={188} height={188}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={82}
              paddingAngle={3}
              cornerRadius={5}
              stroke="none"
              isAnimationActive={motion}
              animationDuration={450}
              onClick={(_, index) => setActive((current) => (current === index ? null : index))}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  opacity={active == null || active === i ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="max-w-[7rem] truncate text-[11px] text-muted">{shownLabel}</p>
          <p className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
            {formatCurrency(shown)}
          </p>
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col">
        {data.map((d, i) => {
          const selected = active === i;
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => setActive((current) => (current === i ? null : i))}
              className={`flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 text-left last:border-0 ${
                selected ? "opacity-100" : active == null ? "opacity-100" : "opacity-45"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums text-foreground">
                {formatCurrency(d.value)}
                <span className="ml-1.5 text-xs text-muted">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
