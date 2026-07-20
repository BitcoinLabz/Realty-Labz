"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

export type PaydownPoint = { label: string; original: number; actual: number };

export function LoanPaydownChart({
  data,
  showActual,
}: {
  data: PaydownPoint[];
  showActual: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {showActual ? (
        <div className="flex flex-wrap items-center gap-5 text-sm text-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-6)" }} />
            Original schedule
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-1)" }} />
            With extra payments
          </span>
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height={300}>
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
          <Line
            dataKey="original"
            name={showActual ? "Original schedule" : "Balance"}
            type="monotone"
            stroke="var(--chart-6)"
            strokeWidth={2}
            strokeDasharray={showActual ? "5 4" : undefined}
            dot={false}
          />
          {showActual ? (
            <Line
              dataKey="actual"
              name="With extra payments"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
