"use client";

import { useActionState, useState } from "react";
import { addHomeOfficeExpenseAction } from "@/app/actions/home-office";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";
import { mortgageInterestForYear, splitMortgagePayment } from "@/lib/home-office";

const initialState: FormState = {};

export type MortgagePrefill = {
  loanAmount: string;
  ratePercent: string;
  termMonths: string;
  firstPaymentMonth: string; // yyyy-mm
  annualTax: string;
  annualInsurance: string;
};

/**
 * Turns "my payment is $2,298" into the parts that matter at tax time. Only
 * interest (and the taxes and insurance, entered as their own costs) is
 * deductible; principal is paying down your own loan.
 */
export function MortgageHelper({ year, prefill }: { year: number; prefill: MortgagePrefill }) {
  const [v, setV] = useState(prefill);
  const [state, formAction, isPending] = useActionState(addHomeOfficeExpenseAction, initialState);
  const [added, setAdded] = useState(false);

  const loanAmount = Number(v.loanAmount);
  const rate = Number(v.ratePercent);
  const term = Number(v.termMonths);
  const ready = loanAmount > 0 && rate >= 0 && term > 0 && /^\d{4}-\d{2}$/.test(v.firstPaymentMonth);

  const firstPayment = ready ? new Date(`${v.firstPaymentMonth}-01T00:00:00.000Z`) : null;
  const now = new Date();
  const paymentNumber = firstPayment
    ? (now.getUTCFullYear() - firstPayment.getUTCFullYear()) * 12 + (now.getUTCMonth() - firstPayment.getUTCMonth()) + 1
    : 1;
  const split = ready
    ? splitMortgagePayment({
        loanAmount,
        annualRatePercent: rate,
        termMonths: term,
        paymentNumber,
        annualPropertyTax: Number(v.annualTax) || 0,
        annualInsurance: Number(v.annualInsurance) || 0,
      })
    : null;
  const yearInterest =
    ready && firstPayment
      ? mortgageInterestForYear({ loanAmount, annualRatePercent: rate, termMonths: term, firstPaymentMonth: firstPayment, year })
      : 0;

  const set = (name: keyof MortgagePrefill) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [name]: e.target.value }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Loan amount" name="m_loan" type="number" inputMode="decimal" min="0" value={v.loanAmount} onChange={set("loanAmount")} />
        <Field label="Interest rate %" name="m_rate" type="number" inputMode="decimal" min="0" step="0.001" value={v.ratePercent} onChange={set("ratePercent")} />
        <Field label="Term (months)" name="m_term" type="number" inputMode="numeric" min="1" value={v.termMonths} onChange={set("termMonths")} />
        <Field label="First payment month" name="m_first" type="month" value={v.firstPaymentMonth} onChange={set("firstPaymentMonth")} />
        <Field label="Yearly property tax" name="m_tax" type="number" inputMode="decimal" min="0" value={v.annualTax} onChange={set("annualTax")} />
        <Field label="Yearly insurance" name="m_ins" type="number" inputMode="decimal" min="0" value={v.annualInsurance} onChange={set("annualInsurance")} />
      </div>

      {split ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface px-4 py-4 text-sm">
          <p className="mb-1 font-medium text-foreground">This month&apos;s payment: {formatCurrency(split.total)}</p>
          <SplitRow label="Interest" value={split.interest} note="Deductible share" />
          <SplitRow label="Property tax (escrow)" value={split.tax} note="Add as Real estate taxes" />
          <SplitRow label="Insurance (escrow)" value={split.insurance} note="Add as insurance" />
          <SplitRow label="Principal" value={split.principal} note="Not deductible" muted />
          <p className="mt-2 border-t border-border pt-3 text-muted">
            Interest paid in {year}: <span className="font-semibold text-foreground">{formatCurrency(yearInterest)}</span>.
            Your lender&apos;s Form 1098 has the exact number.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Fill in your loan to see how each payment splits up.</p>
      )}

      {ready && yearInterest > 0 ? (
        <form
          action={(fd) => {
            setAdded(true);
            return formAction(fd);
          }}
        >
          <input type="hidden" name="kind" value="MORTGAGE_INTEREST" />
          <input type="hidden" name="scope" value="INDIRECT" />
          <input type="hidden" name="period" value="YEAR" />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="amount" value={yearInterest} />
          <input type="hidden" name="description" value="From the mortgage splitter" />
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? "Adding…" : `Add ${formatCurrency(yearInterest)} as ${year} mortgage interest`}
          </Button>
          {added && !isPending && !state.error && !state.fieldErrors ? (
            <p className="mt-2 text-sm text-success">Added to your {year} costs.</p>
          ) : null}
          {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function SplitRow({ label, value, note, muted }: { label: string; value: number; note: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-muted line-through decoration-muted/50" : "text-foreground"}>{label}</span>
      <span className="flex items-baseline gap-3">
        {/* "Not deductible" stays visible on phones; the other notes are extras. */}
        <span className={`text-xs ${muted ? "inline font-medium text-danger" : "hidden text-muted sm:inline"}`}>{note}</span>
        <span className={`tabular-nums ${muted ? "text-muted" : "font-medium text-foreground"}`}>{formatCurrency(value)}</span>
      </span>
    </div>
  );
}
