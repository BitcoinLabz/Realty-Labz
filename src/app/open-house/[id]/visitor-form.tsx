"use client";

import { useActionState, useState } from "react";
import { submitOpenHouseVisitorAction } from "@/app/actions/open-houses";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const initialState: FormState = {};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function VisitorForm({ openHouseId }: { openHouseId: string }) {
  const [state, formAction, isPending] = useActionState(submitOpenHouseVisitorAction, initialState);
  const [interested, setInterested] = useState<"true" | "false" | "">("");
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  if (succeeded) {
    return (
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Thanks for signing in!</p>
        <p className="mt-1 text-sm text-muted">Enjoy the showing.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="openHouseId" value={openHouseId} />
      <Field label="Name" name="name" type="text" required error={state.fieldErrors?.name} />
      <Field label="Email (optional)" name="email" type="email" error={state.fieldErrors?.email} />
      <Field label="Phone (optional)" name="phone" type="tel" error={state.fieldErrors?.phone} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Interested in this home?</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setInterested("true")}
            className={pillClass(interested === "true")}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setInterested("false")}
            className={pillClass(interested === "false")}
          >
            Not for me
          </button>
        </div>
        <input type="hidden" name="interested" value={interested} />
      </div>

      <Textarea
        label="Any feedback? (optional)"
        name="feedback"
        placeholder="What did you think?"
        error={state.fieldErrors?.feedback}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
