"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTransactionAction, updateTransactionAction } from "@/app/actions/transactions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { TransactionType } from "./types";

const initialState: FormState = {};

export type TransactionFormValues = {
  id?: string;
  type: TransactionType;
  category: "HOME_OFFICE" | "PHONE" | "OTHER";
  amount: string;
  description: string;
  date: string;
};

function typePillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function TransactionForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: TransactionFormValues;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateTransactionAction : createTransactionAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] = useState<TransactionType>(defaultValues?.type ?? "EXPENSE");
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
      setType("EXPENSE");
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Type</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setType("EXPENSE")} className={typePillClass(type === "EXPENSE")}>
            Expense
          </button>
          <button type="button" onClick={() => setType("INCOME")} className={typePillClass(type === "INCOME")}>
            Income
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      {type === "EXPENSE" ? (
        <Select
          label="Category"
          name="category"
          defaultValue={defaultValues?.category ?? "OTHER"}
          error={state.fieldErrors?.category}
        >
          <option value="HOME_OFFICE">Home office</option>
          <option value="PHONE">Phone</option>
          <option value="OTHER">Other business expense</option>
        </Select>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
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

      <Field
        label="Description (optional)"
        name="description"
        type="text"
        defaultValue={defaultValues?.description}
        error={state.fieldErrors?.description}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
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
