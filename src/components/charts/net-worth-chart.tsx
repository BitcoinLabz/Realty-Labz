"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

const SERIES = [
  { key: "assets", label: "Assets", color: "var(--chart-2)" },
  { key: "liabilities", label: "Loan balances", color: "var(--chart-6)" },
  { key: "netWorth", label: "Net worth", color: "var(--chart-1)" },
] as const;

export type NetWorthChartPoint = { month: string; assets: number; liabilities: number; netWorth: number };

// Same toggleable-legend pattern as HomeEquityChart -- history only accrues
// from whenever the first asset value snapshot was recorded forward (see
// getNetWorthSeries in src/lib/finance-data.ts), so this can start as a
// single data point and grow over time as more snapshots are logged.
export function NetWorthChart({ data }: { data: NetWorthChartPoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        {SERIES.map((s) => {
          const active = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`flex items-center gap-2 transition-colors ${
                active ? "text-foreground" : "text-muted line-through"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color, opacity: active ? 1 : 0.35 }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v).replace(".00", "")}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 13,
            }}
          />
          {SERIES.map((s) =>
            !hidden.has(s.key) ? (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                dot={false}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
