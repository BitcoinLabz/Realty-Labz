"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function BreakdownDonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* min-w-0 + wrapping so a seven-figure amount next to a long label
          drops below it instead of pushing the page sideways (2026-11-19). */}
      <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-sm">
            <span className="flex min-w-0 items-center gap-2 break-words text-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {d.label}
            </span>
            <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
              {formatCurrency(d.value)}
              <span className="ml-1.5 text-muted">
                ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
