"use client";

import { useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, axisTick, chartMargin, formatAxisCurrency, useChartMotion } from "./chart-theme";

const SERIES = [
  { key: "homeValue", label: "Home value", color: "var(--chart-2)" },
  { key: "balance", label: "Loan balance", color: "var(--chart-6)" },
  { key: "equity", label: "Equity", color: "var(--chart-1)" },
] as const;

export type EquityPoint = { label: string; homeValue: number; balance: number; equity: number };

export function HomeEquityChart({ data }: { data: EquityPoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const motion = useChartMotion();

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

      <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={formatAxisCurrency} width={44} />
          <Tooltip content={<ChartTooltip />} />
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
                isAnimationActive={motion}
                animationDuration={450}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
