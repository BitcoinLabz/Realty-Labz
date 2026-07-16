"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createMileageLogAction, updateMileageLogAction } from "@/app/actions/mileage";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: FormState = {};

export type MileageFormValues = {
  id?: string;
  date: string;
  miles: string;
  isBusiness: boolean;
  note: string;
};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function MileageForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: MileageFormValues;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateMileageLogAction : createMileageLogAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [isBusiness, setIsBusiness] = useState(defaultValues?.isBusiness ?? true);
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
      setIsBusiness(true);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Trip type</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setIsBusiness(true)} className={pillClass(isBusiness)}>
            Business
          </button>
          <button type="button" onClick={() => setIsBusiness(false)} className={pillClass(!isBusiness)}>
            Personal
          </button>
        </div>
        <input type="hidden" name="isBusiness" value={isBusiness ? "true" : "false"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Miles"
          name="miles"
          type="number"
          step="0.1"
          min="0"
          defaultValue={defaultValues?.miles}
          required
          error={state.fieldErrors?.miles}
        />
        <Field
          label="Date"
          name="date"
          type="date"
          defaultValue={defaultValues?.date}
          required
          error={state.fieldErrors?.date}
        />
      </div>

      <Field
        label="Note (optional)"
        name="note"
        type="text"
        placeholder="e.g. Showing to Joe Smith"
        defaultValue={defaultValues?.note}
        error={state.fieldErrors?.note}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Log trip"}
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
