"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createExtraPaymentAction,
  deleteExtraPaymentAction,
} from "@/app/actions/loan-extra-payments";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";

const initialState: FormState = {};

export type ExtraPaymentDTO = {
  id: string;
  date: string; // yyyy-mm-dd
  amount: number;
  notes: string | null;
};

function AddExtraPaymentForm({ loanId }: { loanId: string }) {
  const [state, formAction, isPending] = useActionState(createExtraPaymentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="loanId" value={loanId} />
      <div className="w-40">
        <Field label="Date" name="date" type="date" required error={state.fieldErrors?.date} />
      </div>
      <div className="w-40">
        <Field
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          error={state.fieldErrors?.amount}
        />
      </div>
      <div className="flex-1">
        <Field label="Note (optional)" name="notes" type="text" error={state.fieldErrors?.notes} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add payment"}
      </Button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

export function ExtraPaymentList({
  loanId,
  payments,
}: {
  loanId: string;
  payments: ExtraPaymentDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <AddExtraPaymentForm loanId={loanId} />

      {payments.length === 0 ? (
        <p className="text-sm text-muted">
          No extra payments logged yet — add one above whenever you put extra money toward the
          principal.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(p.amount)}
                </span>
                <span className="text-sm text-muted">
                  {new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {p.notes ? ` · ${p.notes}` : ""}
                </span>
              </div>
              <form action={deleteExtraPaymentAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="loanId" value={loanId} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
