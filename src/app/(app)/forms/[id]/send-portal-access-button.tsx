"use client";

import { useActionState } from "react";
import { sendPortalAccessAction } from "@/app/actions/client-portal";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export function SendPortalAccessButton({
  clientId,
  hasEmail,
}: {
  clientId: string;
  hasEmail: boolean;
}) {
  const [state, formAction, isPending] = useActionState(sendPortalAccessAction, initialState);
  const succeeded = !state.error && state !== initialState;

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Button type="submit" variant="secondary" disabled={isPending || !hasEmail}>
        {isPending ? "Sending…" : "Send portal access"}
      </Button>
      {!hasEmail ? (
        <p className="text-sm text-muted">Add an email address for this client first.</p>
      ) : null}
      {succeeded ? <p className="text-sm text-accent">Portal link sent.</p> : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
