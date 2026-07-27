"use client";

import { useActionState, useState } from "react";
import { createRecurringTransactionAction, deleteRecurringTransactionAction } from "@/app/actions/recurring-transactions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "MARKETING_ADVERTISING", label: "Marketing & advertising" },
  { value: "MLS_DUES", label: "MLS / association dues" },
  { value: "CONTINUING_EDUCATION", label: "Continuing education" },
  { value: "CLIENT_GIFTS", label: "Client gifts" },
  { value: "OFFICE_SUPPLIES", label: "Office supplies" },
  { value: "SOFTWARE_SUBSCRIPTIONS", label: "Software & subscriptions" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "LICENSING_FEES", label: "Licensing fees" },
  { value: "MEALS_ENTERTAINMENT", label: "Meals & entertainment" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional services" },
  { value: "PHONE", label: "Phone" },
  { value: "OTHER", label: "Other business expense" },
];

const initialState: FormState = {};

export type RecurringTemplateDTO = {
  id: string;
  description: string | null;
  category: string | null;
  amount: number;
  scope: "BUSINESS" | "PERSONAL";
  type: "INCOME" | "EXPENSE";
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  nextDueDate: string;
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

function AddRecurringForm() {
  const [state, formAction, isPending] = useActionState(createRecurringTransactionAction, initialState);
  const [scope, setScope] = useState<"BUSINESS" | "PERSONAL">("BUSINESS");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as "BUSINESS" | "PERSONAL")}>
          <option value="BUSINESS">Business</option>
          <option value="PERSONAL">Personal</option>
        </Select>
        <Select label="Type" name="type" value={type} onChange={(e) => setType(e.target.value as "INCOME" | "EXPENSE")}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </Select>
      </div>

      {scope === "BUSINESS" && type === "EXPENSE" ? (
        <Select label="Category" name="category" defaultValue="OTHER" error={state.fieldErrors?.category}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount" name="amount" type="number" step="0.01" min="0" required error={state.fieldErrors?.amount} />
        <Select label="Frequency" name="frequency" defaultValue="MONTHLY">
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="ANNUAL">Annual</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Description (optional)"
          name="description"
          type="text"
          placeholder="e.g. MLS Dues"
          error={state.fieldErrors?.description}
        />
        <Field
          label="Next due date"
          name="nextDueDate"
          type="date"
          required
          error={state.fieldErrors?.nextDueDate}
        />
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add recurring cost"}
        </Button>
      </div>
    </form>
  );
}

export function RecurringTemplates({ templates }: { templates: RecurringTemplateDTO[] }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Recurring costs</h2>
      <p className="mb-6 text-sm text-muted">
        MLS dues, insurance, subscriptions — anything that repeats. You&apos;ll get a reminder when
        one is due, with a one-click way to log it — nothing is created automatically.
      </p>

      <div className="mb-6 max-w-md border-b border-border pb-6">
        <AddRecurringForm />
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">No recurring costs set up yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {t.description || "Recurring cost"}
                </span>
                <span className="text-sm text-muted">
                  {formatCurrency(t.amount)} · {FREQUENCY_LABELS[t.frequency]} · Next:{" "}
                  {new Date(t.nextDueDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <form
                action={deleteRecurringTransactionAction}
                onSubmit={(e) => {
                  if (!confirm("Delete this recurring cost?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
