"use client";

import { useActionState } from "react";
import { submitContactFormAction } from "@/app/actions/contact";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const initialState: FormState = {};

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactFormAction, initialState);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  if (succeeded) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm font-medium text-foreground">Message sent — thanks!</p>
        <p className="mt-1 text-sm text-muted">We&apos;ll get back to you as soon as we can.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-8">
      {/* Honeypot: hidden from real visitors via CSS, not just visually
          off-screen with markup a screen reader would still announce. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Name" name="name" type="text" required error={state.fieldErrors?.name} />
      <Field label="Email" name="email" type="email" required error={state.fieldErrors?.email} />
      <Textarea
        label="How can we help?"
        name="message"
        required
        rows={5}
        error={state.fieldErrors?.message}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
