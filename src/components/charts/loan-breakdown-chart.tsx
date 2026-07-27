"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

// Principal, Interest, Escrow -- matching what a real mortgage statement
// shows (tax + insurance combined into one escrow line, not broken out
// separately). See LoanSummary.monthlyEscrow in loan-calculations.ts.
const SERIES = [
  { key: "principal", label: "Principal", color: "var(--chart-1)" },
  { key: "interest", label: "Interest", color: "var(--chart-5)" },
  { key: "escrow", label: "Escrow", color: "var(--chart-3)" },
] as const;

export type LoanBreakdownPoint = {
  name: string;
  principal: number;
  interest: number;
  escrow: number;
};

export function LoanBreakdownChart({ data }: { data: LoanBreakdownPoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleSeries = SERIES.filter((s) => !hidden.has(s.key));

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

      {visibleSeries.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          All series are hidden — click a label above to show it again.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
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
            {visibleSeries.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="a"
                fill={s.color}
                radius={i === visibleSeries.length - 1 ? [6, 6, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
