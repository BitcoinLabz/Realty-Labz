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
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Upcoming recurring costs</h2>
      <p className="mb-6 text-sm text-muted">
        Logged automatically on their due date — nothing to do here.
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">
              {item.description || "Recurring cost"}
            </span>
            <span className={`text-sm ${item.isOverdue ? "text-danger" : "text-muted"}`}>
              {formatCurrency(item.amount)} ·{" "}
              {new Date(item.nextDueDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {item.isOverdue ? " · Overdue" : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
