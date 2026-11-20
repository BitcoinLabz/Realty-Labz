"use client";

import { useActionState, useState } from "react";
import { saveHomeOfficeSetupAction } from "@/app/actions/home-office";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Toast } from "@/components/ui/toast";
import { HelpTip } from "@/components/ui/help-tip";
import { PillGroup } from "@/components/ui/pill-group";

export type SetupValues = {
  officeLengthFt: string;
  officeWidthFt: string;
  officeSqFt: string;
  homeSqFt: string;
  businessUseStart: string;
  ownership: "OWN" | "RENT";
  purchasePrice: string;
  landValue: string;
  improvementsCost: string;
  fairMarketValueAtStart: string;
};

const initialState: FormState = {};

export function SetupForm({ values }: { values: SetupValues }) {
  const [state, formAction, isPending] = useActionState(saveHomeOfficeSetupAction, initialState);
  const [length, setLength] = useState(values.officeLengthFt);
  const [width, setWidth] = useState(values.officeWidthFt);
  const [sqFt, setSqFt] = useState(values.officeSqFt);
  const [homeSqFt, setHomeSqFt] = useState(values.homeSqFt);
  const [ownership, setOwnership] = useState(values.ownership);
  const [started, setStarted] = useState(values.businessUseStart);
  // Irregular rooms: type the square footage instead of measuring a rectangle.
  const [byDimensions, setByDimensions] = useState(!values.officeSqFt || !!values.officeLengthFt);

  const computedSqFt = byDimensions
    ? Number(length) > 0 && Number(width) > 0
      ? Math.round(Number(length) * Number(width))
      : null
    : Number(sqFt) > 0
      ? Math.round(Number(sqFt))
      : null;
  const percent = computedSqFt && Number(homeSqFt) > 0 ? (computedSqFt / Number(homeSqFt)) * 100 : null;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium text-foreground">Office size</span>
          <button
            type="button"
            onClick={() => setByDimensions((v) => !v)}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            {byDimensions ? "Enter square feet instead" : "Enter length × width instead"}
          </button>
        </div>
        {byDimensions ? (
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Length (ft)"
              name="officeLengthFt"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              error={state.fieldErrors?.officeLengthFt}
            />
            <Field
              label="Width (ft)"
              name="officeWidthFt"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              error={state.fieldErrors?.officeWidthFt}
            />
          </div>
        ) : (
          <Field
            label="Office square feet"
            name="officeSqFt"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={sqFt}
            onChange={(e) => setSqFt(e.target.value)}
            error={state.fieldErrors?.officeSqFt}
          />
        )}
        <Field
          label="Whole home square feet"
          name="homeSqFt"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={homeSqFt}
          onChange={(e) => setHomeSqFt(e.target.value)}
          error={state.fieldErrors?.homeSqFt}
          hint="Finished living space, as on your listing or appraisal."
        />
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface px-4 py-3 text-sm">
          <div>
            <p className="text-muted">Office</p>
            <p className="font-semibold tabular-nums text-foreground">
              {computedSqFt ? `${computedSqFt.toLocaleString()} sq ft` : "—"}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-muted">
              Business use
              <HelpTip text="The office's share of your home. The regular method deducts this share of whole-home costs like utilities and insurance." />
            </p>
            <p className="font-semibold tabular-nums text-foreground">{percent != null ? `${percent.toFixed(1)}%` : "—"}</p>
          </div>
        </div>
      </div>

      <Field
        label="Date you started using it for business"
        name="businessUseStart"
        type="date"
        value={started}
        onChange={(e) => setStarted(e.target.value)}
        error={state.fieldErrors?.businessUseStart}
        hint="Only costs from this month on count in your first year."
      />

      <PillGroup
        label="Do you own or rent?"
        name="ownership"
        value={ownership}
        onChange={setOwnership}
        options={[
          { value: "OWN", label: "Own" },
          { value: "RENT", label: "Rent" },
        ]}
      />

      {ownership === "OWN" ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            For depreciation (regular method only)
            <HelpTip text="Owners can deduct a small part of the home's cost each year (the building, not the land) over 39 years. Your accountant may already have these numbers." />
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Purchase price"
              name="purchasePrice"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={values.purchasePrice}
              error={state.fieldErrors?.purchasePrice}
            />
            <Field
              label="Land value"
              name="landValue"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={values.landValue}
              error={state.fieldErrors?.landValue}
              hint="Land can't be depreciated. Use the land/building split on your property tax assessment."
            />
            <Field
              label="Improvements since buying"
              name="improvementsCost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={values.improvementsCost}
              error={state.fieldErrors?.improvementsCost}
              hint="Roof, addition, remodel — not repairs."
            />
            <Field
              label="Market value when business use began"
              name="fairMarketValueAtStart"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={values.fairMarketValueAtStart}
              error={state.fieldErrors?.fairMarketValueAtStart}
              hint="If it's lower than what you paid, the lower number is used."
            />
          </div>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Toast
        message={!state.error && !state.fieldErrors && state !== initialState ? "Office details saved." : null}
        signal={state}
      />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save setup"}
        </Button>
      </div>
    </form>
  );
}
