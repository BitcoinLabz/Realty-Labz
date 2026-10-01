import type { LucideIcon } from "lucide-react";

// Colour carries meaning, never decoration: blue = in progress, amber =
// under contract / waiting, violet = pending, green = done, red = lost or
// late. Each text colour passes AA inside its own 10% tint (globals.css).
const tones = {
  neutral: "bg-surface text-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  violet: "bg-violet/10 text-violet",
  danger: "bg-danger/10 text-danger",
};

export type BadgeTone = keyof typeof tones;

// Small status/count pill. Replaces the hand-written
// `rounded-full bg-surface px-3 py-1 …` markup that had drifted across the
// files list, client list, and client detail header.
export function Badge({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}
    >
      {Icon ? <Icon size={14} className="shrink-0" /> : null}
      {children}
    </span>
  );
}
