"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createLoanAction, updateLoanAction } from "@/app/actions/loans";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LoanType } from "./types";

const initialState: FormState = {};

const COMMON_TERM_MONTHS = [360, 240, 180, 120, 84, 72, 60, 48, 36];

// Years in the label, months as the value. If an existing loan has a term
// that isn't one of the common ones, it's prepended so editing that loan
// can't silently change its length.
function termOptions(current?: string) {
  const months = [...COMMON_TERM_MONTHS];
  const currentMonths = Number(current);
  if (current && !Number.isNaN(currentMonths) && !months.includes(currentMonths)) {
    months.unshift(currentMonths);
  }
  return months.map((m) => {
    const years = m / 12;
    const label = Number.isInteger(years)
      ? `${years} year${years === 1 ? "" : "s"}`
      : `${m} months`;
    return { value: String(m), label };
  });
}

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
  appreciationRate: string;
  currentHomeValue: string;
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
        // Resetting local UI state after a successful useActionState submit
        // -- the established pattern across every form in this app.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        {/* Was a raw "Term (months)" number box -- nobody thinks of their
            mortgage as 360. Still submits months so the server action and
            all the amortization math are untouched. An existing loan with an
            unusual term keeps its exact value via the extra option below. */}
        <Select
          label="Length of the loan"
          name="termMonths"
          defaultValue={defaultValues?.termMonths ?? "360"}
          error={state.fieldErrors?.termMonths}
        >
          {termOptions(defaultValues?.termMonths).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <Field
        label="Start date"
        name="startDate"
        type="date"
        defaultValue={defaultValues?.startDate}
        required
        error={state.fieldErrors?.startDate}
      />

      {type === "MORTGAGE" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Escrow (taxes &amp; insurance)</p>
            <p className="mt-1 text-sm text-muted">
              Most mortgage statements combine these into one escrow payment along with principal
              and interest — enter them separately here and they&apos;ll show as one combined Escrow
              line everywhere, matching your statement.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
      ) : (
        <Field
          label="Annual insurance (optional)"
          name="annualInsurance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.annualInsurance ?? "0"}
          error={state.fieldErrors?.annualInsurance}
        />
      )}

      {type === "MORTGAGE" ? (
        <>
          <Field
            label="Current home value (optional)"
            name="currentHomeValue"
            type="number"
            step="0.01"
            min="0"
            placeholder="Leave blank to just use the appreciation estimate below"
            defaultValue={defaultValues?.currentHomeValue}
            error={state.fieldErrors?.currentHomeValue}
          />
          <p className="-mt-2 text-sm text-muted">
            If the home is worth more (or less) than pure appreciation would suggest — say, after a
            rehab — enter what it&apos;s actually worth today and future projections will build from
            that instead.
          </p>
          <Field
            label="Expected annual home appreciation (%)"
            name="appreciationRate"
            type="number"
            step="0.001"
            min="-100"
            max="100"
            placeholder="e.g. 3.5"
            defaultValue={defaultValues?.appreciationRate ?? "3.5"}
            error={state.fieldErrors?.appreciationRate}
          />
        </>
      ) : null}

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
