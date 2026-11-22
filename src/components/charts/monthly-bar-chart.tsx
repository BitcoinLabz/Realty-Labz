"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import {
  ChartTooltip,
  axisTick,
  chartCursor,
  chartMargin,
  formatAxisCurrency,
  useChartMotion,
} from "./chart-theme";

export type MonthPoint = { month: string; income: number; expenses: number };

export function MonthlyBarChart({
  data,
  incomeLabel = "Income",
  expensesLabel = "Expenses",
}: {
  data: MonthPoint[];
  incomeLabel?: string;
  expensesLabel?: string;
}) {
  const motion = useChartMotion();
  const active = data.filter((d) => d.income !== 0 || d.expenses !== 0);
  const showIncome = active.some((d) => d.income !== 0);
  const showExpenses = active.some((d) => d.expenses !== 0);

  if (active.length === 0) {
    return <p className="text-sm text-muted">Nothing logged for this period yet.</p>;
  }

  // One or two busy months in a long year is a blank grid with a hairline.
  // A short list says what happened and leaves the empty months unsaid.
  if (active.length < 3 && data.length > active.length + 1) {
    return (
      <div>
        <ul className="divide-y divide-border">
          {active.map((d) => (
            <li key={d.month} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-foreground">{d.month}</span>
              <span className="text-right tabular-nums text-muted">
                {d.income !== 0 ? <span className="text-foreground">{formatCurrency(d.income)} in</span> : null}
                {d.income !== 0 && d.expenses !== 0 ? <span> · </span> : null}
                {d.expenses !== 0 ? <span>{formatCurrency(d.expenses)} out</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-muted">The other months have nothing logged yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-muted">
        {showIncome ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} />
            {incomeLabel}
          </span>
        ) : null}
        {showExpenses ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-6)" }} />
            {expensesLabel}
          </span>
        ) : null}
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={chartMargin} barGap={4} barCategoryGap="18%">
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisCurrency}
              width={44}
            />
            <Tooltip
              cursor={chartCursor}
              content={<ChartTooltip />}
            />
            {showIncome ? (
              <Bar
                dataKey="income"
                name={incomeLabel}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={motion}
                animationDuration={450}
              />
            ) : null}
            {showExpenses ? (
              <Bar
                dataKey="expenses"
                name={expensesLabel}
                fill="var(--chart-6)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={motion}
                animationDuration={450}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
