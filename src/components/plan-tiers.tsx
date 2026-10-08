"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { startCheckoutAction } from "@/app/actions/billing";
import type { FormState } from "@/app/actions/auth";

const initialState: FormState = {};

// The Free / Pro comparison (2026-10-08): price, one clear button, and a
// checklist of what's included -- shown right after sign-up and on
// Account -> Plan. Pro is highlighted as recommended, with a Monthly / Yearly
// switch; yearly is the default because it's the better deal.
export function PlanTiers({
  freeFeatures,
  proFeatures,
  prices,
  current,
  freeAction,
  freeLabel = "Start free",
}: {
  freeFeatures: string[];
  proFeatures: string[];
  prices: { monthly: number; annual: number };
  // Which plan the viewer is on, when they already have one (Account page).
  current?: "FREE" | "PRO";
  // The Free button's action. Omitted on the Account page, where Free is
  // simply "your plan".
  freeAction?: (formData: FormData) => void | Promise<void>;
  freeLabel?: string;
}) {
  const [interval, setInterval] = useState<"annual" | "monthly">("annual");
  const [state, checkoutAction, isPending] = useActionState(startCheckoutAction, initialState);
  const savings = prices.monthly * 12 - prices.annual;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-full border border-border bg-surface p-1">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                interval === option ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {option === "monthly" ? "Monthly" : `Yearly · save $${savings}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-border bg-background">
          <div className="flex flex-col items-center gap-1 border-b border-border px-6 pb-6 pt-8 text-center">
            <h3 className="text-xl font-semibold tracking-wide text-foreground">FREE</h3>
            <p className="text-3xl font-semibold text-foreground">
              $0<span className="text-base font-normal text-muted">/forever</span>
            </p>
            <p className="text-sm text-muted">Everything you do by hand.</p>
            <div className="mt-4 w-full">
              {current === "FREE" ? (
                <p className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted">Your plan</p>
              ) : current === "PRO" ? null : freeAction ? (
                <form action={freeAction}>
                  <button
                    type="submit"
                    className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    {freeLabel}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
          <ul className="flex flex-col gap-2.5 px-6 py-6">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro -- the highlighted one */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-accent bg-background shadow-sm">
          <p className="bg-accent py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-accent-foreground">
            Recommended
          </p>
          <div className="flex flex-col items-center gap-1 border-b border-border px-6 pb-6 pt-6 text-center">
            <h3 className="text-xl font-semibold tracking-wide text-accent">PRO</h3>
            <p className="text-3xl font-semibold text-foreground">
              ${interval === "annual" ? prices.annual : prices.monthly}
              <span className="text-base font-normal text-muted">/{interval === "annual" ? "year" : "month"}</span>
            </p>
            <p className="text-sm text-muted">
              {interval === "annual"
                ? `That's $${(prices.annual / 12).toFixed(2)}/month. Cancel anytime.`
                : "Cancel anytime."}
            </p>
            <div className="mt-4 w-full">
              {current === "PRO" ? (
                <p className="rounded-full bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent">Your plan</p>
              ) : (
                <form action={checkoutAction}>
                  <input type="hidden" name="interval" value={interval} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isPending ? "Opening checkout…" : "Go Pro"}
                  </button>
                  {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
                </form>
              )}
            </div>
          </div>
          <ul className="flex flex-col gap-2.5 px-6 py-6">
            {proFeatures.map((f, i) => (
              <li
                key={f}
                className={`flex items-start gap-2 text-sm ${i === 0 ? "font-medium text-foreground" : "text-foreground"}`}
              >
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
