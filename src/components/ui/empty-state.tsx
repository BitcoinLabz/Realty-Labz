import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Replaces ~35 hand-rolled empty states, 14 of which were dead ends ("No
// clients yet. Add your first one above.") that named no next step and gave
// nothing to click.
//
// The contract is deliberately opinionated: a title says what's missing, the
// description says what the thing IS and why you'd want one -- assume the
// reader has never used this app -- and an action gives them a way to do it
// right now. Only omit the action when the user genuinely can't act (e.g. a
// non-manager who must ask someone else).
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted">
          <Icon size={20} />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
