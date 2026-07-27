"use client";

import { useActionState } from "react";
import { updateTaxSettingsAction } from "@/app/actions/finance-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";
import type { EstimatedTaxSummary } from "@/lib/estimated-tax";

const initialState: FormState = {};

export function TaxEstimateCard({
  estimatedIncomeTaxRatePercent,
  summary,
}: {
  estimatedIncomeTaxRatePercent: number | null;
  summary: EstimatedTaxSummary | null;
}) {
  const [state, formAction, isPending] = useActionState(updateTaxSettingsAction, initialState);

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Estimated quarterly taxes</h2>
      <p className="mb-6 text-sm text-muted">
        A rough estimate — self-employment tax (15.3%) plus your own income tax rate guess, split
        into IRS quarterly due dates. Not tax advice; confirm with an accountant.
      </p>

      <div className="max-w-xs">
        <form action={formAction} className="flex flex-col gap-4">
          <Field
            label="Estimated income tax rate % (federal + state)"
            name="estimatedIncomeTaxRatePercent"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="e.g. 15"
            defaultValue={estimatedIncomeTaxRatePercent ?? ""}
            error={state.fieldErrors?.estimatedIncomeTaxRatePercent}
          />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>

      {summary ? (
        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Self-employment tax (15.3%)</span>
            <span className="font-medium text-foreground">{formatCurrency(summary.selfEmploymentTax)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Estimated income tax</span>
            <span className="font-medium text-foreground">{formatCurrency(summary.incomeTax)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold text-foreground">Total estimated (year)</span>
            <span className="font-semibold text-foreground">{formatCurrency(summary.totalEstimated)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.quarters.map((q) => (
              <div key={q.label} className="rounded-xl border border-border px-3 py-2 text-center">
                <p className="text-xs font-medium text-muted">{q.label}</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(q.amount)}</p>
                <p className="text-xs text-muted">
                  {q.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Enter your estimated income tax rate above to see a quarterly breakdown.
        </p>
      )}
    </section>
  );
}
