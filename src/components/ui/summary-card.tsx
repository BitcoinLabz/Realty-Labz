import { HelpTip } from "./help-tip";

// `hint` exists because several of these tiles show a number whose meaning
// isn't self-evident ("Net commission", "Work in progress") and there was
// previously nowhere to explain it without adding a line of grey text under
// every card.
export function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        {label}
        {hint ? <HelpTip label={label} text={hint} /> : null}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
