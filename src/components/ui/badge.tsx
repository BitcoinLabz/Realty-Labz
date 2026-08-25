import type { LucideIcon } from "lucide-react";

const tones = {
  neutral: "bg-surface text-muted",
  accent: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
};

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
  tone?: keyof typeof tones;
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
