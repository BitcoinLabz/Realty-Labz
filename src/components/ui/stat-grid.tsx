import Link from "next/link";
import { HelpTip } from "./help-tip";

export type StatItem = {
  label: string;
  value: string;
  href?: string;
  hint?: string;
  note?: string;
};

function isNegative(value: string): boolean {
  return value.trim().startsWith("-") || value.trim().startsWith("−");
}

function isZero(value: string): boolean {
  const numeric = value.replace(/[$,\s]/g, "");
  return numeric === "0" || numeric === "0.00" || numeric === "-0.00";
}

// One card, several figures. An even count keeps the last row from leaving
// a half-empty cell. A zero is quieter, with a note about what would fill it.
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-background">
      {items.map((item, i) => {
        const lastRow = i >= items.length - (items.length % 2 === 0 ? 2 : 1);
        const span = i === items.length - 1 && items.length % 2 === 1;
        const quiet = isZero(item.value);
        const cell = (
          <div className="flex min-h-16 flex-col justify-center px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-muted">
              {item.label}
              {item.hint ? <HelpTip label={item.label} text={item.hint} /> : null}
            </p>
            <p
              className={`mt-0.5 tabular-nums tracking-tight ${
                quiet
                  ? "text-base font-medium text-muted"
                  : `text-lg font-semibold ${isNegative(item.value) ? "text-danger" : "text-foreground"}`
              }`}
            >
              {item.value}
            </p>
            {item.note ? <p className="mt-0.5 text-xs text-muted">{item.note}</p> : null}
          </div>
        );
        const className = `min-w-0 ${span ? "col-span-2" : i % 2 === 0 ? "border-r border-border" : ""} ${
          lastRow ? "" : "border-b border-border"
        }`;
        return item.href ? (
          <Link key={item.label} href={item.href} className={`${className} transition-colors hover:bg-surface`}>
            {cell}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {cell}
          </div>
        );
      })}
    </div>
  );
}
