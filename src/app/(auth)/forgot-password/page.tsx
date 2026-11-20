"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/password-reset";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the email on your account. If we have it, we&apos;ll send a link that expires in one hour.
        </p>
      </div>

      {state.success ? (
        <p className="text-sm text-foreground">{state.success}</p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:opacity-80">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
