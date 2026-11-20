"use client";

import { useActionState } from "react";
import { resendEmailVerificationAction } from "@/app/actions/email-verification";
import type { FormState } from "@/app/actions/auth";

const initialState: FormState = {};

// Shown until the account confirms the address they signed up with.
// Deliberately not a block: the app keeps working, this is a nudge.
export function VerifyEmailBanner() {
  const [state, action, pending] = useActionState(resendEmailVerificationAction, initialState);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm text-foreground">
        Confirm your email when you have a minute, so we can reach you about your account.
      </p>
      <form action={action} className="shrink-0">
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-medium text-accent hover:opacity-80 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send the link again"}
        </button>
      </form>
      {state.error ? <p className="text-sm text-danger sm:basis-full">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent sm:basis-full">{state.success}</p> : null}
    </div>
  );
}
