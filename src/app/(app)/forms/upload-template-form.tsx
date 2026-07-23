"use client";

import { useActionState } from "react";
import { uploadFormTemplateAction } from "@/app/actions/form-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export function UploadTemplateForm() {
  const [state, formAction, isPending] = useActionState(uploadFormTemplateAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Template name"
        name="name"
        type="text"
        placeholder="e.g. Standard Purchase Agreement"
        required
        error={state.fieldErrors?.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="form-template-file" className="text-sm font-medium text-foreground">
          PDF
        </label>
        <input
          id="form-template-file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
        />
        {state.fieldErrors?.file ? <p className="text-sm text-danger">{state.fieldErrors.file}</p> : null}
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Add template"}
        </Button>
      </div>
    </form>
  );
}
