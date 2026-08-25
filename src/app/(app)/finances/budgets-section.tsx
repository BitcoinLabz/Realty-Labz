"use client";

import { useActionState } from "react";
import { createBudgetAction, deleteBudgetAction } from "@/app/actions/budgets";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/transaction-categories";
import type { BudgetUsage } from "@/lib/finance-data";

const initialState: FormState = {};

function BudgetForm() {
  const [state, formAction, isPending] = useActionState(createBudgetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Business or personal?" name="scope" defaultValue="BUSINESS">
          <option value="BUSINESS">Business</option>
          <option value="PERSONAL">Personal</option>
        </Select>
        <Select label="Category (optional — leave blank for overall)" name="category" defaultValue="">
          <option value="">Overall</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <Field
        label="Monthly limit"
        name="monthlyLimit"
        type="number"
        step="0.01"
        min="0"
        required
        error={state.fieldErrors?.monthlyLimit}
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add budget"}
        </Button>
      </div>
    </form>
  );
}

export function BudgetsSection({ budgets }: { budgets: BudgetUsage[] }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Budgets</h2>
      <p className="mb-6 text-sm text-muted">Monthly spending limits, business or personal.</p>

      <div className="mb-6 max-w-md border-b border-border pb-6">
        <BudgetForm />
      </div>

      {budgets.length === 0 ? (
        <p className="text-sm text-muted">No spending limits set. Add one above to get a heads-up when a category is running hot.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {budgets.map((b) => {
            const label = b.category ? (CATEGORY_LABELS[b.category] ?? b.category) : "Overall";
            const overBudget = b.percentUsed > 100;
            return (
              <div key={b.budgetId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {b.scope === "BUSINESS" ? "Business" : "Personal"} · {label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">
                      {formatCurrency(b.spent)} / {formatCurrency(b.monthlyLimit)}
                    </span>
                    <form action={deleteBudgetAction}>
                      <input type="hidden" name="id" value={b.budgetId} />
                      <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full transition-all ${overBudget ? "bg-danger" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, b.percentUsed)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
