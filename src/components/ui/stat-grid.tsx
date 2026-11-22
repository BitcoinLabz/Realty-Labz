import Link from "next/link";
import { HelpTip } from "./help-tip";

export type StatItem = {
  label: string;
  value: string;
  href?: string;
  hint?: string;
};

function isNegative(value: string): boolean {
  return value.trim().startsWith("-") || value.trim().startsWith("−");
}

// One card, several figures. Replaces a stack of full-width tiles that each
// held a single number and a large empty interior.
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-background">
      {items.map((item, i) => {
        const lastRow = i >= items.length - (items.length % 2 === 0 ? 2 : 1);
        const span = i === items.length - 1 && items.length % 2 === 1;
        const cell = (
          <div className="flex min-h-16 flex-col justify-center px-4 py-3">
            <p className="flex items-center gap-1 text-xs text-muted">
              {item.label}
              {item.hint ? <HelpTip label={item.label} text={item.hint} /> : null}
            </p>
            <p
              className={`mt-0.5 text-lg font-semibold tabular-nums tracking-tight ${
                isNegative(item.value) ? "text-danger" : "text-foreground"
              }`}
            >
              {item.value}
            </p>
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
