import Link from "next/link";
import { AlertTriangle, CalendarX, FileWarning, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AttentionItem } from "@/lib/finance-data";

const KIND_ICON = {
  overdue: CalendarX,
  missingDocs: FileWarning,
  awaitingSignature: PenLine,
} as const;

// Only overdue dates get the alarm colour. Missing paperwork and a quiet
// signature request are nudges, not emergencies -- colouring all three red
// would train the user to ignore the section entirely.
const KIND_TONE = {
  overdue: "text-danger",
  missingDocs: "text-muted",
  awaitingSignature: "text-muted",
} as const;

// Long lists stop being triage and start being a backlog to scroll past.
const MAX_SHOWN = 6;

/**
 * The dashboard's one-stop triage list. Everything here was already findable
 * -- on the transaction page, the client page, the forms list -- but only if
 * you went looking. This turns "check five places" into "read one list", and
 * renders nothing at all when there's nothing to do.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  const shown = items.slice(0, MAX_SHOWN);
  const hidden = items.length - shown.length;

  return (
    <Card
      title="Needs your attention"
      icon={AlertTriangle}
      description="Dates that have passed, transactions with no paperwork, and contracts nobody has signed."
    >
      <div className="flex flex-col gap-2">
        {shown.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent"
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${KIND_TONE[item.kind]}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
              </div>
            </Link>
          );
        })}
        {hidden > 0 ? (
          <p className="px-1 pt-1 text-sm text-muted">
            and {hidden} more {hidden === 1 ? "item" : "items"}.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
