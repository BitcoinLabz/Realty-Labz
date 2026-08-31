"use client";

import { useActionState, useState } from "react";
import { leaveTeamAction } from "@/app/actions/team-members";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function LeaveTeamForm({ orgWord, teamName }: { orgWord: string; teamName: string }) {
  const [state, formAction, isPending] = useActionState(leaveTeamAction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-danger hover:opacity-80"
      >
        Leave this {orgWord}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <p className="text-sm text-muted">
        You keep your account and everything on it — clients, transactions, finances, all of it.
        {" "}
        {teamName} keeps a read-only record of the transactions that closed while you were there,
        which brokers are required to hold on to. They lose access to everything else.
      </p>
      <Field
        label={`Type LEAVE to confirm`}
        name="confirm"
        type="text"
        autoComplete="off"
        required
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="danger" disabled={isPending}>
          {isPending ? "Leaving…" : `Leave ${teamName}`}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
