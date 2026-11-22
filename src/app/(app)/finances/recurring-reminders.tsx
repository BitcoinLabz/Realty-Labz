import { formatCurrency } from "@/lib/format";
import type { DueRecurringItem } from "@/lib/finance-data";

// Purely informational -- as of 2026-07-27, recurring costs auto-log
// themselves (see autoLogDueRecurringTransactions in
// src/app/actions/recurring-transactions.ts, run on every page view via
// src/app/(app)/layout.tsx), so anything with nextDueDate <= today has
// already been logged by the time this renders. This just shows what's
// coming up next, with no action needed. Shown on both /finances and
// /dashboard, same as before.
export function RecurringReminders({ items }: { items: DueRecurringItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-background px-4 py-3">
      <h2 className="text-sm font-semibold text-foreground">Upcoming costs</h2>
      <p className="mt-0.5 text-xs text-muted">Logged on the due date. Nothing to do here.</p>
      <div className="mt-2 divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 truncate text-sm text-foreground">
              {item.description || "Recurring cost"}
            </span>
            <span
              className={`shrink-0 text-sm tabular-nums ${item.isOverdue ? "text-danger" : "text-muted"}`}
            >
              {formatCurrency(item.amount)}
              <span className="ml-2">
                {new Date(item.nextDueDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {item.isOverdue ? " · Overdue" : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
