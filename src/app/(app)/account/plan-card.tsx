"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { openBillingPortalAction } from "@/app/actions/billing";
import { PlanTiers } from "@/components/plan-tiers";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export type PlanCardProps = {
  isPro: boolean;
  comped: boolean;
  hasBillingAccount: boolean;
  renewsOn: string | null; // formatted
  cancelsOn: string | null; // formatted, when cancel-at-period-end
  usedLabel: string;
  limitLabel: string | null; // null = unlimited
  usedPercent: number | null;
  features: string[];
  freeFeatures: string[];
  prices: { monthly: number; annual: number };
  justUpgraded: boolean;
};

function ManageBilling() {
  const [state, formAction, isPending] = useActionState(openBillingPortalAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Opening…" : "Manage billing"}
      </Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function PlanCard(props: PlanCardProps) {
  const { isPro } = props;
  return (
    <div className="flex flex-col gap-6">
      {props.justUpgraded && isPro ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          Welcome to Pro. Everything below is switched on.
        </p>
      ) : props.justUpgraded ? (
        // Stripe's confirmation can take a few seconds to reach us.
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
          Payment received — Pro switches on in a few seconds. Refresh if it hasn&apos;t yet.
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {isPro ? <Sparkles size={18} className="text-accent" /> : null}
          {isPro ? "Pro" : "Free"}
        </p>
        <p className="text-sm text-muted">
          {props.comped
            ? "Pro, on the house."
            : isPro
              ? props.cancelsOn
                ? `Ends ${props.cancelsOn}. You keep Pro until then.`
                : props.renewsOn
                  ? `Renews ${props.renewsOn}.`
                  : "Active."
              : "Everything you do by hand is free, forever."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-foreground">Storage</span>
          <span className="text-muted">
            {props.usedLabel}
            {props.limitLabel ? ` of ${props.limitLabel}` : " · unlimited"}
          </span>
        </div>
        {props.usedPercent !== null ? (
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${props.usedPercent >= 90 ? "bg-danger" : props.usedPercent >= 75 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${Math.min(100, props.usedPercent)}%` }}
            />
          </div>
        ) : null}
      </div>

      {!isPro ? (
        <PlanTiers
          freeFeatures={props.freeFeatures}
          proFeatures={props.features}
          prices={props.prices}
          current="FREE"
        />
      ) : props.hasBillingAccount && !props.comped ? (
        <div>
          <ManageBilling />
          <p className="mt-2 text-xs text-muted">Change your card, switch monthly/annual, see invoices, or cancel.</p>
        </div>
      ) : null}
    </div>
  );
}
