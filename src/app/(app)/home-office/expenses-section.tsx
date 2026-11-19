"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { addHomeOfficeExpenseAction, deleteHomeOfficeExpenseAction } from "@/app/actions/home-office";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { PillGroup } from "@/components/ui/pill-group";
import { RowMenu } from "@/components/ui/row-menu";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { ExpenseKind } from "@/lib/home-office";
import { HOME_OFFICE_EXPENSE_LABELS, OWNER_ONLY_KINDS, RENTER_ONLY_KINDS } from "@/lib/home-office-labels";

export type ExpenseRow = {
  id: string;
  kind: ExpenseKind;
  scope: "DIRECT" | "INDIRECT";
  period: "MONTH" | "YEAR";
  date: string; // yyyy-mm-dd
  amount: number;
  description: string | null;
  receipt: { id: string; fileName: string } | null;
  /** False for a bill from before business use began. */
  counted: boolean;
};

const initialState: FormState = {};

function whenLabel(row: ExpenseRow): string {
  const d = new Date(`${row.date}T00:00:00.000Z`);
  return row.period === "YEAR"
    ? `Full year ${d.getUTCFullYear()}`
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function ExpensesSection({
  year,
  ownership,
  expenses,
}: {
  year: number;
  ownership: "OWN" | "RENT";
  expenses: ExpenseRow[];
}) {
  const [state, formAction, isPending] = useActionState(addHomeOfficeExpenseAction, initialState);
  const [period, setPeriod] = useState<"MONTH" | "YEAR">("MONTH");
  const [scope, setScope] = useState<"DIRECT" | "INDIRECT">("INDIRECT");
  const [formKey, setFormKey] = useState(0);
  const lastState = useRef(state);

  // Clear the form after a successful add (a fresh key also resets the file
  // input, which form.reset() leaves holding the old file's name).
  useEffect(() => {
    if (state !== lastState.current && !state.error && !state.fieldErrors) setFormKey((k) => k + 1);
    lastState.current = state;
  }, [state]);

  const kinds = (Object.keys(HOME_OFFICE_EXPENSE_LABELS) as ExpenseKind[]).filter((k) =>
    ownership === "OWN" ? !RENTER_ONLY_KINDS.includes(k) : !OWNER_ONLY_KINDS.includes(k),
  );
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const defaultMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-6">
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <Select label="What is it?" name="kind" defaultValue={kinds[0]} error={state.fieldErrors?.kind}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {HOME_OFFICE_EXPENSE_LABELS[k]}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PillGroup
            label="One bill or a year's total?"
            name="period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "MONTH", label: "One month" },
              { value: "YEAR", label: "Full year" },
            ]}
          />
          <PillGroup
            label="Whole home or just the office?"
            name="scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "INDIRECT", label: "Whole home" },
              { value: "DIRECT", label: "Just the office" },
            ]}
          />
        </div>
        <p className="-mt-2 text-sm text-muted">
          {scope === "DIRECT"
            ? "Costs only for the office, like painting it, count in full."
            : "Whole-home costs count at your business-use share."}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {period === "MONTH" ? (
            <Field
              label="Month"
              name="month"
              type="month"
              defaultValue={defaultMonth}
              error={state.fieldErrors?.month}
            />
          ) : (
            <Field
              label="Year"
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={String(year)}
              error={state.fieldErrors?.year}
            />
          )}
          <Field
            label="Amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            error={state.fieldErrors?.amount}
          />
        </div>
        <Field label="Note (optional)" name="description" maxLength={200} placeholder="e.g. Consumers Energy" />
        <FileDropInput name="receipt" label="Receipt (optional)" />
        {state.fieldErrors?.receipt ? <p className="-mt-2 text-sm text-danger">{state.fieldErrors.receipt}</p> : null}
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add cost"}
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-6">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted">No home costs for {year} yet. Add your first bill above.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">
                      {HOME_OFFICE_EXPENSE_LABELS[e.kind]}
                    </p>
                    <p className="line-clamp-2 break-words text-sm text-muted">
                      {whenLabel(e)} · {e.scope === "DIRECT" ? "Office only" : "Whole home"}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                    {e.counted ? null : (
                      <p className="text-xs text-warning">Before you started using the office, so it isn&apos;t counted.</p>
                    )}
                    {e.receipt ? (
                      <a
                        href={`/api/documents/${e.receipt.id}`}
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
                      >
                        <Paperclip size={12} className="shrink-0" />
                        <span className="truncate">{e.receipt.fileName}</span>
                      </a>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(e.amount)}
                  </span>
                  <RowMenu
                    label={`Actions for ${HOME_OFFICE_EXPENSE_LABELS[e.kind]}`}
                    items={[
                      {
                        label: "Delete",
                        destructive: true,
                        confirm: e.receipt ? "Delete this cost and its receipt?" : "Delete this cost?",
                        action: deleteHomeOfficeExpenseAction,
                        fields: { id: e.id },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted">Total entered for {year}</span>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
