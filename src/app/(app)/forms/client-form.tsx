"use client";

import { useActionState, useEffect, useRef } from "react";
import { createClientAction, updateClientAction } from "@/app/actions/clients";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_SOURCE_LABELS, CLIENT_STAGE_LABELS } from "@/lib/client-categories";

const initialState: FormState = {};

export type ClientFormValues = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  stage: string;
};

export function ClientForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: ClientFormValues;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateClientAction : createClientAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      // Only reset for create — see CLAUDE.md's note on the uncontrolled-form
      // staleness bug. Edit mode relies on the parent keying this component
      // by the client's updatedAt so a successful save remounts with fresh
      // defaultValues instead.
      if (!isEdit) formRef.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

      <Field
        label="Name"
        name="name"
        type="text"
        defaultValue={defaultValues?.name}
        required
        error={state.fieldErrors?.name}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Email (optional)"
          name="email"
          type="email"
          defaultValue={defaultValues?.email}
          error={state.fieldErrors?.email}
        />
        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          defaultValue={defaultValues?.phone}
          error={state.fieldErrors?.phone}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Lead source (optional)"
          name="source"
          defaultValue={defaultValues?.source ?? ""}
          error={state.fieldErrors?.source}
        >
          <option value="">Not set</option>
          {Object.entries(CLIENT_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="Stage"
          name="stage"
          defaultValue={defaultValues?.stage ?? "NEW"}
          error={state.fieldErrors?.stage}
        >
          {Object.entries(CLIENT_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        label="Notes (optional)"
        name="notes"
        defaultValue={defaultValues?.notes}
        error={state.fieldErrors?.notes}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add client"}
        </Button>
        {isEdit ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
