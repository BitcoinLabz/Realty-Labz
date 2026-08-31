"use client";

import { useActionState } from "react";
import { updateFinanceSharingAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-surface">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{description}</span>
      </span>
    </label>
  );
}

export function FinanceSharingForm({
  orgWord,
  shareBusinessFinances,
  shareMileage,
}: {
  orgWord: string;
  shareBusinessFinances: boolean;
  shareMileage: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateFinanceSharingAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Toggle
          name="shareBusinessFinances"
          label="Business income & expenses"
          description={`Your ${orgWord}'s managers can see your business income and expense totals for the year. Not the individual entries.`}
          defaultChecked={shareBusinessFinances}
        />
        <Toggle
          name="shareMileage"
          label="Mileage"
          description="Your total business miles and the deduction they add up to."
          defaultChecked={shareMileage}
        />
      </div>

      <div className="rounded-xl bg-surface p-4">
        <p className="text-sm font-medium text-foreground">Always private, whatever you pick</p>
        <p className="mt-1 text-sm text-muted">
          Your investments, your loans, your personal income and expenses, and your clients.
          There&apos;s no setting that shares these — not for a team lead, not for a broker.
        </p>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
