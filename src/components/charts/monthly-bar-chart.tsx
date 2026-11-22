"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ChartTooltip,
  axisTick,
  chartCursor,
  chartMargin,
  formatAxisCurrency,
  useChartMotion,
} from "./chart-theme";

export function MonthlyBarChart({
  data,
  incomeLabel = "Income",
  expensesLabel = "Expenses",
}: {
  data: { month: string; income: number; expenses: number }[];
  incomeLabel?: string;
  expensesLabel?: string;
}) {
  const motion = useChartMotion();
  const showIncome = data.some((d) => d.income !== 0);
  const showExpenses = data.some((d) => d.expenses !== 0);

  if (!showIncome && !showExpenses) {
    return <p className="text-sm text-muted">Nothing logged for this period yet.</p>;
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
          <BarChart data={data} margin={chartMargin} barGap={3} barCategoryGap="32%">
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
                maxBarSize={16}
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
                maxBarSize={16}
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
