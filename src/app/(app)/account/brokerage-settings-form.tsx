"use client";

import { useActionState } from "react";
import { updateBrokerageSettingsAction } from "@/app/actions/team-members";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function BrokerageSettingsForm({
  name,
  brokerageNumber,
}: {
  name: string;
  brokerageNumber: string;
}) {
  const [state, formAction, isPending] = useActionState(updateBrokerageSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Brokerage name" name="name" defaultValue={name} required error={state.fieldErrors?.name} />
      <Field
        label="Brokerage license number (optional)"
        name="brokerageNumber"
        defaultValue={brokerageNumber}
        error={state.fieldErrors?.brokerageNumber}
        hint="When set, agents type it to confirm they're joining the right office."
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
