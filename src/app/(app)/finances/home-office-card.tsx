"use client";

import { useActionState } from "react";
import { updateHomeOfficeSettingsAction } from "@/app/actions/finance-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";

const initialState: FormState = {};

export function HomeOfficeCard({
  homeOfficeSqFt,
  deduction,
}: {
  homeOfficeSqFt: number | null;
  deduction: number;
}) {
  const [state, formAction, isPending] = useActionState(updateHomeOfficeSettingsAction, initialState);

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">Home office deduction</h2>
      <p className="mb-6 text-sm text-muted">
        IRS Simplified method — $5 per sq ft of office space, capped at 300 sq ft ($1,500/yr max).
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="max-w-xs flex-1">
          <form action={formAction} className="flex flex-col gap-4">
            <Field
              label="Office square footage"
              name="homeOfficeSqFt"
              type="number"
              min="0"
              step="1"
              defaultValue={homeOfficeSqFt ?? ""}
              error={state.fieldErrors?.homeOfficeSqFt}
            />
            {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
            <div>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>

        <div className="sm:pb-1">
          <p className="text-sm text-muted">Annual deduction</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {formatCurrency(deduction)}
          </p>
        </div>
      </div>
    </section>
  );
}
