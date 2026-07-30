"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createDealAction, updateDealAction } from "@/app/actions/deals";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ClientOption } from "@/app/(app)/forms/types";
import type { DealDTO, DealSide, ReferralPartnerOption } from "./types";

const initialState: FormState = {};

export type DealFormValues = {
  id?: string;
  side: DealSide;
  status: DealDTO["status"];
  propertyAddress: string;
  mlsNumber: string;
  listPrice: string;
  salePrice: string;
  commissionRate: string;
  commissionAmount: string;
  brokerageSplitPercent: string;
  referralFeeAmount: string;
  referralPartnerId: string;
  teamSplitAmount: string;
  otherDeductions: string;
  closingDate: string;
  notes: string;
  clientId: string;
};

function sidePillClass(active: boolean) {
  return `rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function DealForm({
  clients,
  referralPartners,
  defaultValues,
  onDone,
  lockedClientId,
}: {
  clients?: ClientOption[];
  referralPartners?: ReferralPartnerOption[];
  defaultValues?: DealFormValues;
  onDone?: () => void;
  lockedClientId?: string;
}) {
  const isEdit = !!defaultValues?.id;
  const action = isEdit ? updateDealAction : createDealAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [side, setSide] = useState<DealSide>(defaultValues?.side ?? "BUYER");
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      // Only reset for create — for edit, resetting would revert the form to
      // its stale pre-save defaultValues (an uncontrolled form's .reset()
      // restores its *original* mount-time values, not freshly-saved ones).
      // The parent keys this component by the deal's updatedAt instead, so a
      // successful edit remounts with correct fresh values.
      if (!isEdit) formRef.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" defaultValue={defaultValues!.id} /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Side</span>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setSide("BUYER")} className={sidePillClass(side === "BUYER")}>
            Buyer
          </button>
          <button type="button" onClick={() => setSide("SELLER")} className={sidePillClass(side === "SELLER")}>
            Seller
          </button>
          <button type="button" onClick={() => setSide("DUAL")} className={sidePillClass(side === "DUAL")}>
            Dual
          </button>
        </div>
        <input type="hidden" name="side" value={side} />
      </div>

      <Field
        label="Property address"
        name="propertyAddress"
        type="text"
        defaultValue={defaultValues?.propertyAddress}
        required
        error={state.fieldErrors?.propertyAddress}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="MLS number (optional)"
          name="mlsNumber"
          type="text"
          defaultValue={defaultValues?.mlsNumber}
          error={state.fieldErrors?.mlsNumber}
        />
        <Select
          label="Status"
          name="status"
          defaultValue={defaultValues?.status ?? "ACTIVE"}
          error={state.fieldErrors?.status}
        >
          <option value="ACTIVE">Active</option>
          <option value="UNDER_CONTRACT">Under Contract</option>
          <option value="PENDING">Pending</option>
          <option value="CLOSED">Closed</option>
          <option value="FELL_THROUGH">Fell Through</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="List price (optional)"
          name="listPrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.listPrice}
          error={state.fieldErrors?.listPrice}
        />
        <Field
          label="Sale price (optional)"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.salePrice}
          error={state.fieldErrors?.salePrice}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Commission rate % (optional)"
          name="commissionRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={defaultValues?.commissionRate}
          error={state.fieldErrors?.commissionRate}
        />
        <Field
          label="Commission amount (optional)"
          name="commissionAmount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.commissionAmount}
          error={state.fieldErrors?.commissionAmount}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-medium text-foreground">Commission split (optional)</p>
        <p className="-mt-2 text-sm text-muted">
          Net commission = commission amount, minus the brokerage&apos;s cut, minus any referral fee,
          team split, or other deduction.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Brokerage split % (optional)"
            name="brokerageSplitPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 30"
            defaultValue={defaultValues?.brokerageSplitPercent}
            error={state.fieldErrors?.brokerageSplitPercent}
          />
          <Field
            label="Referral fee (optional)"
            name="referralFeeAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.referralFeeAmount}
            error={state.fieldErrors?.referralFeeAmount}
          />
        </div>
        {referralPartners && referralPartners.length > 0 ? (
          <Select
            label="Referral owed to (optional)"
            name="referralPartnerId"
            defaultValue={defaultValues?.referralPartnerId ?? ""}
            error={state.fieldErrors?.referralPartnerId}
          >
            <option value="">No partner</option>
            {referralPartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Team split (optional)"
            name="teamSplitAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.teamSplitAmount}
            error={state.fieldErrors?.teamSplitAmount}
          />
          <Field
            label="Other deductions (optional)"
            name="otherDeductions"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.otherDeductions}
            error={state.fieldErrors?.otherDeductions}
          />
        </div>
      </div>

      <Field
        label="Closing date (optional)"
        name="closingDate"
        type="date"
        defaultValue={defaultValues?.closingDate}
        error={state.fieldErrors?.closingDate}
      />

      {lockedClientId ? (
        <input type="hidden" name="clientId" value={lockedClientId} />
      ) : clients && clients.length > 0 ? (
        <Select label="Client (optional)" name="clientId" defaultValue={defaultValues?.clientId ?? ""}>
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Textarea
        label="Notes (optional)"
        name="notes"
        defaultValue={defaultValues?.notes}
        error={state.fieldErrors?.notes}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add deal"}
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
