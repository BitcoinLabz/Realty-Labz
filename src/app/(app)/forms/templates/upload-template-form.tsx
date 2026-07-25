"use client";

import { useActionState } from "react";
import { uploadFormTemplateAction } from "@/app/actions/form-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileDropInput } from "@/components/ui/file-drop-input";

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
      <FileDropInput
        id="form-template-file"
        label="PDF"
        accept="application/pdf"
        required
        error={state.fieldErrors?.file}
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Add template"}
        </Button>
      </div>
    </form>
  );
}
