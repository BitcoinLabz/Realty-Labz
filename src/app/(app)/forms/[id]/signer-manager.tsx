"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTemplateSignerAction, deleteTemplateSignerAction } from "@/app/actions/form-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { TemplateSignerDTO } from "../types";

const initialState: FormState = {};

export function SignerManager({
  templateId,
  signers,
}: {
  templateId: string;
  signers: TemplateSignerDTO[];
}) {
  const [state, formAction, isPending] = useActionState(addTemplateSignerAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {signers.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
          >
            <span className="text-sm font-medium text-foreground">{s.label}</span>
            {signers.length > 1 ? (
              <form action={deleteTemplateSignerAction}>
                <input type="hidden" name="templateId" value={templateId} />
                <input type="hidden" name="signerId" value={s.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Remove
                </button>
              </form>
            ) : null}
          </div>
        ))}
      </div>

      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="templateId" value={templateId} />
        <div className="flex-1">
          <Field label="Add a signer" name="label" type="text" placeholder="e.g. Seller" error={state.fieldErrors?.label} />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          Add
        </Button>
      </form>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </div>
  );
}
