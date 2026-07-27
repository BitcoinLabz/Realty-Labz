import { logRecurringTransactionAction } from "@/app/actions/recurring-transactions";
import { formatCurrency } from "@/lib/format";
import type { DueRecurringItem } from "@/lib/finance-data";

// Deliberately reminder-only, not silent auto-creation -- see
// src/lib/recurring.ts and src/app/actions/recurring-transactions.ts. Shown
// on both /finances and /dashboard (same component, same "due now" framing
// as the existing deal-deadline alerts).
export function RecurringReminders({ items }: { items: DueRecurringItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-6 text-base font-semibold text-foreground">Recurring costs due</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
          >
            <div className="flex flex-col">
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
            <form action={logRecurringTransactionAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                Log it
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
