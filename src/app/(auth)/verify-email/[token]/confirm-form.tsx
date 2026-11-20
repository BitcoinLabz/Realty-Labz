"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmailAction } from "@/app/actions/email-verification";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmailAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Confirm your email</h1>
        <p className="mt-1 text-sm text-muted">
          {state.success ?? "This confirms the address on your Realty Labz account."}
        </p>
      </div>

      {state.success ? null : (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Confirming…" : "Confirm email"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/dashboard" className="font-medium text-accent hover:opacity-80">
          Go to your account
        </Link>
      </p>
    </div>
  );
}
