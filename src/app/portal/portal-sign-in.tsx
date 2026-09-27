"use client";

import { useActionState } from "react";
import { requestPortalSignInAction } from "@/app/actions/client-portal";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";

const initialState: FormState = {};

// What a client sees at /portal with no session: a one-field sign-in. No
// password -- they get a link by email, the same way their agent first
// invited them.
export function PortalSignIn({ expired }: { expired: boolean }) {
  const [state, formAction, isPending] = useActionState(requestPortalSignInAction, initialState);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo size="md" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {expired ? "Your link has expired" : "Sign in to your portal"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {expired
              ? "For your security, sign-in links don't last forever. Enter your email and we'll send you a fresh one."
              : "See your properties, key dates, and documents. Enter the email your agent has for you and we'll send a sign-in link."}
          </p>
        </div>

        {state.success ? (
          <div className="rounded-2xl border border-border bg-background p-6 text-sm text-foreground">
            {state.success}
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={state.fieldErrors?.email}
            />
            {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Email me a sign-in link"}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted">No password needed. Only you can open the link we send.</p>
      </div>
    </div>
  );
}
