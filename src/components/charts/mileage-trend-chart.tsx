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
  const active = data.filter((d) => d.miles !== 0 || d.deduction !== 0);
  if (active.length > 0 && active.length < 3 && data.length > active.length + 1) {
    return (
      <div>
        <ul className="divide-y divide-border">
          {active.map((d) => (
            <li key={d.month} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-foreground">{d.month}</span>
              <span className="tabular-nums text-muted">
                {d.miles.toLocaleString()} mi · {formatCurrency(d.deduction)}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-muted">The other months have no trips yet.</p>
      </div>
    );
  }
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
        <ComposedChart data={data} margin={chartMargin} barCategoryGap="18%">
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
            maxBarSize={28}
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
