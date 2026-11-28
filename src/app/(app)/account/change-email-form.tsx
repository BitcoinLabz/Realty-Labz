"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { cancelEmailChangeAction, requestEmailChangeAction } from "@/app/actions/email-change";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

// Changing the sign-in email (2026-11-28). The new address gets a link and
// nothing changes until it's clicked; while that's outstanding this shows
// what's pending, with a way to cancel or start over.
export function ChangeEmailForm({
  currentEmail,
  hasPassword,
  pendingEmail,
}: {
  currentEmail: string;
  hasPassword: boolean;
  pendingEmail: string | null;
}) {
  const [state, formAction, isPending] = useActionState(requestEmailChangeAction, initialState);
  const [startOver, setStartOver] = useState(false);

  if (pendingEmail && !startOver) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm text-foreground">
          <MailCheck size={17} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Waiting for you to confirm <span className="font-medium break-all">{pendingEmail}</span>. Open the link we
            sent there; it works for 24 hours. Until then you still sign in with{" "}
            <span className="font-medium break-all">{currentEmail}</span>.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setStartOver(true)}>
            Use a different address
          </Button>
          <form action={cancelEmailChangeAction}>
            <Button type="submit" variant="ghost">
              Cancel the change
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        You sign in with <span className="font-medium break-all text-foreground">{currentEmail}</span>. If you use Google
        to sign in, pick the address of the Google account you want to use.
      </p>
      <Field
        label="New email"
        name="newEmail"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.newEmail}
      />
      {hasPassword ? (
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.currentPassword}
          hint="So nobody can change it from a device you left signed in."
        />
      ) : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send confirmation link"}
        </Button>
      </div>
    </form>
  );
}
