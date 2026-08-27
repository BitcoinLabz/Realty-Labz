"use client";

import { useActionState, useState } from "react";
import { submitOpenHouseVisitorAction } from "@/app/actions/open-houses";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const initialState: FormState = {};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

/**
 * An open house is a shared device on a table: one visitor signs in, walks
 * off, and the next person picks it up. Without a way back to a blank form
 * that second visitor finds someone else's thank-you screen and the agent
 * has to reload the page by hand between every single guest.
 *
 * Bumping the key fully remounts the inner form, which is what resets
 * useActionState -- its state isn't resettable in place.
 */
export function VisitorForm({ openHouseId }: { openHouseId: string }) {
  const [signInCount, setSignInCount] = useState(0);

  return (
    <VisitorFormFields
      key={signInCount}
      openHouseId={openHouseId}
      onSignInAnother={() => setSignInCount((n) => n + 1)}
    />
  );
}

function VisitorFormFields({
  openHouseId,
  onSignInAnother,
}: {
  openHouseId: string;
  onSignInAnother: () => void;
}) {
  const [state, formAction, isPending] = useActionState(submitOpenHouseVisitorAction, initialState);
  const [interested, setInterested] = useState<"true" | "false" | "">("");
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-2xl">
          👋
        </span>
        <div>
          <p className="text-base font-medium text-foreground">Thanks for signing in!</p>
          <p className="mt-1 text-sm text-muted">Enjoy looking around.</p>
        </div>
        <button
          type="button"
          onClick={onSignInAnother}
          className="text-sm font-medium text-accent hover:opacity-80"
        >
          Sign in another visitor
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="openHouseId" value={openHouseId} />
      <Field label="Your name" name="name" type="text" required error={state.fieldErrors?.name} />
      <Field label="Email (optional)" name="email" type="email" error={state.fieldErrors?.email} />
      <Field label="Phone (optional)" name="phone" type="tel" error={state.fieldErrors?.phone} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Could you see yourself living here?
        </span>
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
        label="Any thoughts on the home? (optional)"
        name="feedback"
        placeholder="What stood out to you?"
        error={state.fieldErrors?.feedback}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted">
        Your details go to the agent hosting this open house so they can follow up.
      </p>
    </form>
  );
}
