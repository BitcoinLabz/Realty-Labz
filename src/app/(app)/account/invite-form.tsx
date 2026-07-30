"use client";

import { useActionState } from "react";
import { createInviteAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const initialState: FormState = {};

export function InviteForm() {
  const [state, formAction, isPending] = useActionState(createInviteAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="w-48">
        <Select label="Role" name="role" defaultValue="AGENT" error={state.fieldErrors?.role}>
          <option value="AGENT">Agent</option>
          <option value="TEAM_LEAD">Team Lead</option>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create invite link"}
      </Button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
