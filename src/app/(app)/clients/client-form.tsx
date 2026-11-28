"use client";

import { useActionState, useEffect, useRef } from "react";
import { createClientAction, updateClientAction } from "@/app/actions/clients";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { submitKeepingValues } from "@/lib/form-submit";
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
  street: string;
  city: string;
  state: string;
  zip: string;
  source: string;
  stage: string;
  emailDeadlineReminders: boolean;
};

export function ClientForm({
  defaultValues,
  onDone,
  onCancel,
  inModal = false,
}: {
  defaultValues?: ClientFormValues;
  onDone?: () => void;
  /** Shows a Cancel button that closes without saving. */
  onCancel?: () => void;
  /** Pins Save/Cancel to the bottom of a Modal's scrolling body. */
  inModal?: boolean;
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
    <form ref={formRef} onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
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
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium text-foreground">Address (optional)</legend>
        <Field
          label="Street"
          name="street"
          type="text"
          autoComplete="off"
          defaultValue={defaultValues?.street}
          error={state.fieldErrors?.street}
        />
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6 sm:col-span-3">
            <Field
              label="City"
              name="city"
              type="text"
              autoComplete="off"
              defaultValue={defaultValues?.city}
              error={state.fieldErrors?.city}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field
              label="State"
              name="state"
              type="text"
              autoComplete="off"
              maxLength={50}
              defaultValue={defaultValues?.state ?? (isEdit ? "" : "MI")}
              error={state.fieldErrors?.state}
            />
          </div>
          <div className="col-span-4 sm:col-span-2">
            <Field
              label="ZIP"
              name="zip"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              defaultValue={defaultValues?.zip}
              error={state.fieldErrors?.zip}
            />
          </div>
        </div>
      </fieldset>

      <Textarea
        label="Notes (optional)"
        name="notes"
        defaultValue={defaultValues?.notes}
        error={state.fieldErrors?.notes}
      />

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="emailDeadlineReminders"
          value="true"
          defaultChecked={defaultValues?.emailDeadlineReminders ?? true}
          className="mt-1"
        />
        Email this client as contract deadlines approach
      </label>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div
        className={
          inModal
            ? "sticky -bottom-5 -mx-5 -mb-5 flex gap-2 border-t border-border bg-background px-5 py-4 sm:-mx-6 sm:px-6"
            : "flex gap-2"
        }
      >
        <Button type="submit" disabled={isPending} className={inModal ? "min-h-11 flex-1 sm:flex-none" : ""}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Save"}
        </Button>
        {onCancel || isEdit ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel ?? onDone}
            className={inModal ? "min-h-11 flex-1 sm:flex-none" : ""}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
