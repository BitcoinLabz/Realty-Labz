import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// One page title treatment, replacing five hand-copied variants. Also gives
// sub-pages a real <h1> -- several previously had none at all, which reads
// as a headless page to a screen reader and looks unanchored to everyone
// else.
export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-muted hover:text-foreground"
          >
            <ChevronLeft size={16} />
            {backLabel ?? "Back"}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
