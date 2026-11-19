"use client";

import { useActionState } from "react";
import { updateTaxSettingsAction } from "@/app/actions/finance-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { HelpTip } from "@/components/ui/help-tip";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { EstimatedTaxSummary } from "@/lib/estimated-tax";
import { MICHIGAN_TAX_CITIES } from "@/lib/tax-rules-data";

const initialState: FormState = {};

function Row({ label, value, tip, strong }: { label: React.ReactNode; value: string; tip?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "border-t border-border pt-2" : ""}`}>
      <span className={`flex items-center gap-1.5 ${strong ? "font-semibold text-foreground" : "text-muted"}`}>
        {label}
        {tip ? <HelpTip text={tip} /> : null}
      </span>
      <span className={`shrink-0 tabular-nums ${strong ? "font-semibold" : "font-medium"} text-foreground`}>{value}</span>
    </div>
  );
}

export function TaxEstimateCard({
  estimatedIncomeTaxRatePercent,
  residenceCity,
  workCity,
  summary,
}: {
  estimatedIncomeTaxRatePercent: number | null;
  residenceCity: string | null;
  workCity: string | null;
  summary: EstimatedTaxSummary;
}) {
  const [state, formAction, isPending] = useActionState(updateTaxSettingsAction, initialState);

  return (
    <section className="rounded-2xl border border-border bg-background p-6 sm:p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Estimated taxes</h2>
      <p className="mb-6 text-sm text-muted">
        What your business profit this year may owe, split into the four quarterly payments. An estimate to plan
        with, not tax advice — confirm with your accountant.
      </p>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="Federal income tax rate %"
          name="estimatedIncomeTaxRatePercent"
          type="number"
          min="0"
          max="100"
          step="0.1"
          placeholder="e.g. 12"
          defaultValue={estimatedIncomeTaxRatePercent ?? ""}
          error={state.fieldErrors?.estimatedIncomeTaxRatePercent}
          hint="Your bracket, from last year's return or your accountant. Michigan and city tax are added for you."
        />
        <Select label="City you live in" name="residenceCity" defaultValue={residenceCity ?? ""} error={state.fieldErrors?.residenceCity}>
          <option value="">No city income tax</option>
          {MICHIGAN_TAX_CITIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="City your office is in" name="workCity" defaultValue={workCity ?? ""} error={state.fieldErrors?.workCity}>
          <option value="">No city income tax</option>
          {MICHIGAN_TAX_CITIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
        {state.error ? <p className="text-sm text-danger sm:col-span-3">{state.error}</p> : null}
        <div className="sm:col-span-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6 text-sm">
        <Row label="Business profit so far" value={formatCurrency(summary.netBusinessIncome)} />
        <Row
          label="Self-employment tax"
          value={formatCurrency(summary.selfEmploymentTax)}
          tip="Social Security and Medicare for people who work for themselves: 15.3% of 92.35% of your profit. Half of it is deducted before income tax."
        />
        <Row
          label="Federal income tax"
          value={summary.federalIncomeTax == null ? "Add your rate" : formatCurrency(summary.federalIncomeTax)}
        />
        <Row
          label={`Michigan income tax (${(summary.michiganRate * 100).toFixed(2)}%)`}
          value={formatCurrency(summary.michiganIncomeTax)}
          tip="Michigan's flat rate on your profit after one personal exemption."
        />
        {summary.cityLabel ? (
          <Row label={`City income tax (${summary.cityLabel})`} value={formatCurrency(summary.cityIncomeTax)} />
        ) : null}
        <Row label="Total for the year" value={formatCurrency(summary.totalEstimated)} strong />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.quarters.map((q) => (
            <div key={q.label} className="rounded-xl border border-border px-3 py-2 text-center">
              <p className="text-xs font-medium text-muted">{q.label}</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(q.amount)}</p>
              <p className="text-xs text-muted">
                Due {q.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
