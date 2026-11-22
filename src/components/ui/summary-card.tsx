import type { LucideIcon } from "lucide-react";
import { HelpTip } from "./help-tip";

export function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: string;
}) {
  const negative = value.trim().startsWith("-") || value.trim().startsWith("−");
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {Icon ? <Icon size={14} className="shrink-0" /> : null}
        {label}
        {hint ? <HelpTip label={label} text={hint} /> : null}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
          negative ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
