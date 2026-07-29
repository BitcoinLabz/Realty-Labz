"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTransactionOrRecurringAction, updateTransactionAction } from "@/app/actions/transactions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { DealOption, TransactionCategory, TransactionScope, TransactionType } from "./types";

const initialState: FormState = {};

const CATEGORY_OPTIONS: { value: TransactionCategory; label: string }[] = [
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

export type TransactionFormValues = {
  id?: string;
  type: TransactionType;
  scope: TransactionScope;
  category: TransactionCategory;
  amount: string;
  description: string;
  date: string;
  dealId?: string;
};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function TransactionForm({
  defaultValues,
  deals = [],
  onDone,
}: {
  defaultValues?: TransactionFormValues;
  deals?: DealOption[];
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  // Recurring is only offered when adding a brand-new entry -- an
  // already-logged Transaction is a concrete dated row, not something you
  // convert into a recurring template after the fact.
  const canBeRecurring = !isEdit;
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  // isEdit never changes for the lifetime of a given form instance (a fresh
  // component is used per add-vs-edit), so it's safe to pick the action once
  // via this ternary. isRecurring, in contrast, toggles WITHIN one mounted
  // instance -- see the "isRecurring" hidden field below and the comment on
  // createTransactionOrRecurringAction for why that can't be handled by
  // swapping the action reference itself.
  const action = isEdit ? updateTransactionAction : createTransactionOrRecurringAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [scope, setScope] = useState<TransactionScope>(defaultValues?.scope ?? "BUSINESS");
  const [type, setType] = useState<TransactionType>(defaultValues?.type ?? "EXPENSE");
  const formRef = useRef<HTMLFormElement>(null);
  const showDealPicker = !isRecurring && scope === "BUSINESS" && type === "EXPENSE" && deals.length > 0;

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
      setScope("BUSINESS");
      setType("EXPENSE");
      setIsRecurring(false);
      setIsSplit(false);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}
      {canBeRecurring ? <input type="hidden" name="isRecurring" value={isRecurring ? "true" : "false"} /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Scope</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setScope("BUSINESS")} className={pillClass(scope === "BUSINESS")}>
            Business
          </button>
          <button type="button" onClick={() => setScope("PERSONAL")} className={pillClass(scope === "PERSONAL")}>
            Personal
          </button>
        </div>
        <input type="hidden" name="scope" value={scope} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Type</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setType("EXPENSE")} className={pillClass(type === "EXPENSE")}>
            Expense
          </button>
          <button type="button" onClick={() => setType("INCOME")} className={pillClass(type === "INCOME")}>
            Income
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
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

      {canBeRecurring ? (
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            Make this a recurring cost
          </label>

          {isRecurring ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
              <p className="text-sm text-muted">
                Logged automatically on the due date below, and every due date going forward — no
                more manual entry. If the due date is in the past, it&apos;ll catch up on every
                missed period immediately.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select label="Frequency" name="frequency" defaultValue="MONTHLY">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </Select>
                <Field
                  label="Next due date"
                  name="nextDueDate"
                  type="date"
                  required
                  error={state.fieldErrors?.nextDueDate}
                />
              </div>

              {type === "EXPENSE" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Split between business &amp; personal?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSplit(false)}
                      className={pillClass(!isSplit)}
                    >
                      No, all one scope
                    </button>
                    <button type="button" onClick={() => setIsSplit(true)} className={pillClass(isSplit)}>
                      Yes, split by %
                    </button>
                  </div>
                </div>
              ) : null}

              {type === "EXPENSE" && isSplit ? (
                <Field
                  label="% business use (the rest counts as personal)"
                  name="businessUsePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="e.g. 60"
                  required
                  error={state.fieldErrors?.businessUsePercent}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showDealPicker ? (
        <Select
          label="Deal (optional)"
          name="dealId"
          defaultValue={defaultValues?.dealId ?? ""}
          error={state.fieldErrors?.dealId}
        >
          <option value="">No deal</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.propertyAddress}
            </option>
          ))}
        </Select>
      ) : null}

      {!isRecurring ? (
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
          <Field
            label="Date"
            name="date"
            type="date"
            defaultValue={defaultValues?.date}
            required
            error={state.fieldErrors?.date}
          />
        </div>
      ) : (
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
      )}

      <Field
        label="Description (optional)"
        name="description"
        type="text"
        placeholder={scope === "PERSONAL" ? "e.g. Paycheck, groceries" : undefined}
        defaultValue={defaultValues?.description}
        error={state.fieldErrors?.description}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isRecurring ? "Add recurring cost" : isEdit ? "Save changes" : "Add transaction"}
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
