"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function AcceptInviteForm({
  inviteId,
  teamName,
  // Whether this brokerage set a number at all. Teams created before
  // brokerage numbers existed have none, and stay joinable without one.
  requiresBrokerageNumber,
  // Only asked when the account doesn't already have one on file.
  needsLicenseNumber,
}: {
  inviteId: string;
  teamName: string;
  requiresBrokerageNumber: boolean;
  needsLicenseNumber: boolean;
}) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="inviteId" value={inviteId} />

      {requiresBrokerageNumber ? (
        <Field
          label={`${teamName}'s license number`}
          name="brokerageNumber"
          type="text"
          required
          error={state.fieldErrors?.brokerageNumber}
          hint="Confirms you're joining the office you meant to. Ask them for it if you don't have it."
        />
      ) : null}

      {needsLicenseNumber ? (
        <Field
          label="Your real estate license number"
          name="licenseNumber"
          type="text"
          required
          error={state.fieldErrors?.licenseNumber}
          hint="We don't have this on your account yet."
        />
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Joining…" : `Join ${teamName}`}
      </Button>
    </form>
  );
}
