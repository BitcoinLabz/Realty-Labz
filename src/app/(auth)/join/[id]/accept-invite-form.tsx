"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: FormState = {};

export function AcceptInviteForm({ inviteId, teamName }: { inviteId: string; teamName: string }) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="inviteId" value={inviteId} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Joining…" : `Join ${teamName}`}
      </Button>
    </form>
  );
}
