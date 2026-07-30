"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Full name"
        name="name"
        type="text"
        defaultValue={name}
        required
        error={state.fieldErrors?.name}
      />
      <Field label="Email" name="email" type="email" defaultValue={email} disabled />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
