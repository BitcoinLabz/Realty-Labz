"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, axisTick, chartMargin, formatAxisCurrency, useChartMotion } from "./chart-theme";

export type PaydownPoint = { label: string; original: number; actual: number };

export function LoanPaydownChart({
  data,
  showActual,
}: {
  data: PaydownPoint[];
  showActual: boolean;
}) {
  const motion = useChartMotion();
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
      <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={formatAxisCurrency} width={44} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            dataKey="original"
            name={showActual ? "Original schedule" : "Balance"}
            type="monotone"
            stroke="var(--chart-6)"
            strokeWidth={2}
            strokeDasharray={showActual ? "5 4" : undefined}
            dot={false}
            isAnimationActive={motion}
            animationDuration={450}
          />
          {showActual ? (
            <Line
              dataKey="actual"
              name="With extra payments"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={motion}
              animationDuration={450}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
