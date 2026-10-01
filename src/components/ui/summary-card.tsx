import type { LucideIcon } from "lucide-react";
import { HelpTip } from "./help-tip";
import { TONE_CHIP, type Tone } from "./tone";

// `hint` exists because several of these tiles show a number whose meaning
// isn't self-evident ("Net commission", "Work in progress") and there was
// previously nowhere to explain it without adding a line of grey text under
// every card.
export function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: string;
  hint?: string;
  // Optional tinted icon chip, so a row of tiles reads at a glance.
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      {Icon ? (
        <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}>
          <Icon size={18} />
        </span>
      ) : null}
      <p className="flex items-center gap-1.5 text-sm text-muted">
        {label}
        {hint ? <HelpTip label={label} text={hint} /> : null}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
