"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createLoanAction, updateLoanAction } from "@/app/actions/loans";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { LoanType } from "./types";

const initialState: FormState = {};

export type LoanFormValues = {
  id?: string;
  name: string;
  type: LoanType;
  purchasePrice: string;
  downPayment: string;
  interestRate: string;
  termMonths: string;
  startDate: string;
  annualPropertyTax: string;
  annualInsurance: string;
  notes: string;
};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function LoanForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: LoanFormValues;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateLoanAction : createLoanAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] = useState<LoanType>(defaultValues?.type ?? "MORTGAGE");
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      if (!isEdit) {
        formRef.current?.reset();
        setType("MORTGAGE");
      }
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

      <Field
        label="Name"
        name="name"
        type="text"
        placeholder="e.g. Primary residence, 2024 Honda Civic"
        defaultValue={defaultValues?.name}
        required
        error={state.fieldErrors?.name}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Type</span>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setType("MORTGAGE")} className={pillClass(type === "MORTGAGE")}>
            Mortgage
          </button>
          <button type="button" onClick={() => setType("AUTO")} className={pillClass(type === "AUTO")}>
            Auto
          </button>
          <button type="button" onClick={() => setType("OTHER")} className={pillClass(type === "OTHER")}>
            Other
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Purchase price"
          name="purchasePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.purchasePrice}
          required
          error={state.fieldErrors?.purchasePrice}
        />
        <Field
          label="Down payment"
          name="downPayment"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.downPayment ?? "0"}
          error={state.fieldErrors?.downPayment}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Interest rate (%)"
          name="interestRate"
          type="number"
          step="0.001"
          min="0"
          max="100"
          placeholder="e.g. 6.5"
          defaultValue={defaultValues?.interestRate}
          required
          error={state.fieldErrors?.interestRate}
        />
        <Field
          label="Term (months)"
          name="termMonths"
          type="number"
          step="1"
          min="1"
          placeholder="e.g. 360 for 30 years"
          defaultValue={defaultValues?.termMonths}
          required
          error={state.fieldErrors?.termMonths}
        />
      </div>

      <Field
        label="Start date"
        name="startDate"
        type="date"
        defaultValue={defaultValues?.startDate}
        required
        error={state.fieldErrors?.startDate}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Annual property tax (optional)"
          name="annualPropertyTax"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.annualPropertyTax ?? "0"}
          error={state.fieldErrors?.annualPropertyTax}
        />
        <Field
          label="Annual insurance (optional)"
          name="annualInsurance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.annualInsurance ?? "0"}
          error={state.fieldErrors?.annualInsurance}
        />
      </div>

      <Textarea
        label="Notes (optional)"
        name="notes"
        defaultValue={defaultValues?.notes}
        error={state.fieldErrors?.notes}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add loan"}
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
