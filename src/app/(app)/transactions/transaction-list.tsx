"use client";

import { useState } from "react";
import { deleteTransactionAction } from "@/app/actions/transactions";
import { formatCurrency } from "@/lib/format";
import { TransactionForm } from "./transaction-form";
import type { TransactionDTO } from "./types";

const categoryLabels: Record<string, string> = {
  MILEAGE: "Mileage",
  HOME_OFFICE: "Home office",
  PHONE: "Phone",
  OTHER: "Other",
};

export function TransactionList({ transactions }: { transactions: TransactionDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No transactions yet for this year. Add your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((t) =>
        editingId === t.id ? (
          <div key={t.id} className="rounded-2xl border border-accent bg-background p-6">
            <TransactionForm
              defaultValues={{
                id: t.id,
                type: t.type,
                category: t.category === "MILEAGE" ? "OTHER" : t.category,
                amount: String(t.amount),
                description: t.description ?? "",
                date: t.date,
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div
            key={t.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {t.description || categoryLabels[t.category]}
              </span>
              <span className="text-sm text-muted">
                {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {t.type === "EXPENSE" ? ` · ${categoryLabels[t.category]}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`text-sm font-semibold ${t.type === "INCOME" ? "text-accent" : "text-foreground"}`}
              >
                {t.type === "INCOME" ? "+" : "-"}
                {formatCurrency(t.amount)}
              </span>
              <button
                type="button"
                onClick={() => setEditingId(t.id)}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Edit
              </button>
              <form
                action={deleteTransactionAction}
                onSubmit={(e) => {
                  if (!confirm("Delete this transaction?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
