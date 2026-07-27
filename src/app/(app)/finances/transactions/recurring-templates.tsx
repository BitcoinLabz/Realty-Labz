"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
  updateRecurringTransactionAction,
} from "@/app/actions/recurring-transactions";
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
  updatedAt: string;
};

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

function RecurringForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: RecurringTemplateDTO;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateRecurringTransactionAction : createRecurringTransactionAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [scope, setScope] = useState<"BUSINESS" | "PERSONAL">(defaultValues?.scope ?? "BUSINESS");
  const [type, setType] = useState<"INCOME" | "EXPENSE">(defaultValues?.type ?? "EXPENSE");
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      if (!isEdit) {
        formRef.current?.reset();
        setScope("BUSINESS");
        setType("EXPENSE");
      }
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

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
        <Select
          label="Category"
          name="category"
          defaultValue={defaultValues?.category ?? "OTHER"}
          error={state.fieldErrors?.category}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.amount}
          required
          error={state.fieldErrors?.amount}
        />
        <Select label="Frequency" name="frequency" defaultValue={defaultValues?.frequency ?? "MONTHLY"}>
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
          defaultValue={defaultValues?.description ?? undefined}
          error={state.fieldErrors?.description}
        />
        <Field
          label="Next due date"
          name="nextDueDate"
          type="date"
          defaultValue={defaultValues?.nextDueDate}
          required
          error={state.fieldErrors?.nextDueDate}
        />
      </div>
      {isEdit ? (
        <p className="-mt-2 text-sm text-muted">
          Changing the amount only affects what gets logged going forward — anything already logged
          in Transactions stays exactly as it was.
        </p>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add recurring cost"}
        </Button>
        {isEdit ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function RecurringTemplates({ templates }: { templates: RecurringTemplateDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Recurring costs</h2>
      <p className="mb-6 text-sm text-muted">
        MLS dues, insurance, subscriptions — anything that repeats. Logged automatically on the due
        date you set, and backdated to catch up on any missed periods if the start date is in the
        past.
      </p>

      <div className="mb-6 max-w-md border-b border-border pb-6">
        <RecurringForm />
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">No recurring costs set up yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="rounded-xl border border-accent px-4 py-4">
                <RecurringForm key={t.updatedAt} defaultValues={t} onDone={() => setEditingId(null)} />
              </div>
            ) : (
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
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="text-sm font-medium text-muted hover:text-foreground"
                  >
                    Edit
                  </button>
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
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
