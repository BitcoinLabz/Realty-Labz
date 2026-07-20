"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export function MonthlyBarChart({
  data,
  incomeLabel = "Income",
  expensesLabel = "Expenses",
}: {
  data: { month: string; income: number; expenses: number }[];
  incomeLabel?: string;
  expensesLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5 text-sm text-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-1)" }} />
          {incomeLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--chart-6)" }} />
          {expensesLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          <Bar dataKey="income" name={incomeLabel} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name={expensesLabel} fill="var(--chart-6)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
