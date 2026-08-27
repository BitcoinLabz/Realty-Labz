"use client";

import { useActionState } from "react";
import { createInviteAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const initialState: FormState = {};

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, formAction, isPending] = useActionState(createInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="sm:flex-1">
        <Select label="Role" name="role" defaultValue="AGENT" error={state.fieldErrors?.role}>
          <option value="AGENT">Agent — sees only their own work</option>
          <option value="TEAM_LEAD">Team lead — sees everyone&apos;s transactions</option>
          {canInviteAdmin ? (
            <option value="ADMIN">Admin — can also manage who&apos;s on the roster</option>
          ) : null}
        </Select>
      </div>
      <Button type="submit" disabled={isPending} className="shrink-0">
        {isPending ? "Creating…" : "Create invite link"}
      </Button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
