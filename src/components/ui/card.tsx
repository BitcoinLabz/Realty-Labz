import type { LucideIcon } from "lucide-react";

// The app's one section container. Replaces ~40 hand-copied instances of
// `rounded-2xl border border-border bg-background p-8` with a single place
// that also standardises the heading, the description line under it, and the
// optional right-aligned action link -- all three of which were previously
// spelled slightly differently on every page.
export function Card({
  title,
  description,
  action,
  icon: Icon,
  children,
  className = "",
}: {
  title?: string;
  description?: React.ReactNode;
  // Right-aligned control on the heading row (a link, a button, a select).
  action?: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  const hasHeader = !!title || !!action;

  return (
    <section className={`rounded-2xl border border-border bg-background p-6 sm:p-8 ${className}`}>
      {hasHeader ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                {Icon ? <Icon size={17} className="shrink-0 text-muted" /> : null}
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
