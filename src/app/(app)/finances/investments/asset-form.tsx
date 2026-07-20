"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAssetAction, updateAssetAction } from "@/app/actions/assets";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { AssetType } from "./types";

const initialState: FormState = {};

export type AssetFormValues = {
  id?: string;
  name: string;
  type: AssetType;
  currentValue: string;
  notes: string;
};

export function AssetForm({
  defaultValues,
  onDone,
}: {
  defaultValues?: AssetFormValues;
  onDone?: () => void;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateAssetAction : createAssetAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
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
        placeholder="e.g. Fidelity 401(k), Rental at 123 Oak St"
        defaultValue={defaultValues?.name}
        required
        error={state.fieldErrors?.name}
      />

      <Select
        label="Type"
        name="type"
        defaultValue={defaultValues?.type ?? "STOCKS"}
        error={state.fieldErrors?.type}
      >
        <option value="STOCKS">Stocks</option>
        <option value="RETIREMENT">Retirement</option>
        <option value="REAL_ESTATE">Real estate</option>
        <option value="CRYPTO">Crypto</option>
        <option value="SAVINGS">Savings</option>
        <option value="OTHER">Other</option>
      </Select>

      <Field
        label="Current value"
        name="currentValue"
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValues?.currentValue}
        required
        error={state.fieldErrors?.currentValue}
      />

      <Field
        label="Notes (optional)"
        name="notes"
        type="text"
        defaultValue={defaultValues?.notes}
        error={state.fieldErrors?.notes}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add asset"}
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
