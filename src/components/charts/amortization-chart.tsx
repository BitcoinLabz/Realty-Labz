"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

// Colors matched to the same "Principal"/"Interest"/"Balance" language
// already used across the other loan charts (LoanBreakdownChart's Principal
// is chart-1, Interest is chart-5; balance-style lines elsewhere use chart-6).
const SERIES = [
  { key: "balance", label: "Balance", color: "var(--chart-6)" },
  { key: "principalToDate", label: "Principal to date", color: "var(--chart-1)" },
  { key: "interestToDate", label: "Interest to date", color: "var(--chart-5)" },
] as const;

export type AmortizationChartPoint = {
  label: string;
  balance: number;
  principalToDate: number;
  interestToDate: number;
};

// The full amortization curve for one loan -- Balance, cumulative Principal
// paid, and cumulative Interest paid, each its own toggleable line, same
// interaction pattern as HomeEquityChart/NetWorthChart.
export function AmortizationChart({ data }: { data: AmortizationChartPoint[] }) {
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
            dataKey="label"
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
