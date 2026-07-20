"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export function MileageTrendChart({
  data,
}: {
  data: { month: string; miles: number; deduction: number }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5 text-sm text-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-1)" }} />
          Deduction
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-3)" }} />
          Miles
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="deduction"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v).replace(".00", "")}
            width={72}
          />
          <YAxis
            yAxisId="miles"
            orientation="right"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "Miles" ? `${Number(value).toLocaleString()} mi` : formatCurrency(Number(value))
            }
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 13,
            }}
          />
          <Bar
            yAxisId="deduction"
            dataKey="deduction"
            name="Deduction"
            fill="var(--chart-1)"
            radius={[6, 6, 0, 0]}
          />
          <Line
            yAxisId="miles"
            dataKey="miles"
            name="Miles"
            type="monotone"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
