"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/password-reset";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">At least 8 characters. This link works once.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.newPassword}
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirmPassword}
        />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-medium text-accent hover:opacity-80">
          Request a new link
        </Link>
      </p>
    </div>
  );
}
