"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmailChangeAction } from "@/app/actions/email-change";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export function ConfirmEmailChangeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmEmailChangeAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {state.success ? "Email changed" : "Confirm your new email"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {state.success ?? "This makes this address the one you sign in to Realty Labz with."}
        </p>
      </div>

      {state.success ? (
        <Link
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Confirming…" : "Confirm new email"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/account" className="font-medium text-accent hover:opacity-80">
          Go to Settings
        </Link>
      </p>
    </div>
  );
}
