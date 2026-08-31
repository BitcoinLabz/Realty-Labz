"use client";

import { useActionState } from "react";
import { joinTeamAction } from "@/app/actions/team-invites";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function JoinForm({
  inviteId,
  teamName,
  requiresBrokerageNumber,
}: {
  inviteId: string;
  teamName: string;
  requiresBrokerageNumber: boolean;
}) {
  const [state, formAction, isPending] = useActionState(joinTeamAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="inviteId" value={inviteId} />

      <Field
        label="Full name"
        name="name"
        type="text"
        autoComplete="name"
        required
        error={state.fieldErrors?.name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
      />
      <Field
        label="Your real estate license number"
        name="licenseNumber"
        type="text"
        required
        error={state.fieldErrors?.licenseNumber}
        hint="Your own salesperson license."
      />

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

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Join team"}
      </Button>
    </form>
  );
}
