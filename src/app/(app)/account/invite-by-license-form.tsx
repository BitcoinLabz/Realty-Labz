"use client";

import { useActionState, useRef, useEffect } from "react";
import { inviteByLicenseNumberAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const initialState: FormState = {};

export function InviteByLicenseForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, formAction, isPending] = useActionState(
    inviteByLicenseNumberAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field
        label="Their license number"
        name="licenseNumber"
        type="text"
        required
        error={state.fieldErrors?.licenseNumber}
        hint="We'll email the invitation straight to them."
      />
      <div className="sm:max-w-xs">
        <Select label="Join as" name="role" defaultValue="AGENT" error={state.fieldErrors?.role}>
          <option value="AGENT">Agent — sees only their own work</option>
          <option value="TEAM_LEAD">Team lead — sees everyone&apos;s transactions</option>
          {canInviteAdmin ? (
            <option value="ADMIN">Admin — can also manage who&apos;s on the roster</option>
          ) : null}
        </Select>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
