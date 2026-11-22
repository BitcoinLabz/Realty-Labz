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
import { ChartTooltip, axisTick, chartCursor, chartMargin, formatAxisCurrency, useChartMotion } from "./chart-theme";

export function MileageTrendChart({
  data,
}: {
  data: { month: string; miles: number; deduction: number }[];
}) {
  const motion = useChartMotion();
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
      <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={chartMargin} barCategoryGap="32%">
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="deduction"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAxisCurrency}
            width={44}
          />
          <YAxis yAxisId="miles" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            cursor={chartCursor}
            content={
              <ChartTooltip
                formatValue={(value, name) =>
                  name === "Miles" ? `${Number(value).toLocaleString()} mi` : formatCurrency(value)
                }
              />
            }
          />
          <Bar
            yAxisId="deduction"
            dataKey="deduction"
            name="Deduction"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            isAnimationActive={motion}
            animationDuration={450}
          />
          <Line
            yAxisId="miles"
            dataKey="miles"
            name="Miles"
            type="monotone"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={motion}
            animationDuration={450}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
