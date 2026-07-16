"use client";

import { useActionState, useRef, useEffect } from "react";
import { changePasswordAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
    }
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.currentPassword}
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.newPassword}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      {succeeded ? <p className="text-sm text-accent">Password updated.</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
