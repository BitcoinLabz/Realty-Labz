"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createDealAction, updateDealAction } from "@/app/actions/deals";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { calculateCommissionAmount, calculateNetCommission } from "@/lib/commission";
import { Textarea } from "@/components/ui/textarea";
import type { ClientOption } from "@/app/(app)/clients/types";
import { DEAL_SIDE_LABELS, type DealDTO, type DealSide, type ReferralPartnerOption } from "./types";

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
  referralFeePercent: string;
  referralPartnerId: string;
  teamSplitPercent: string;
  otherDeductionsPercent: string;
  closingDate: string;
  notes: string;
  clientId: string;
};

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
  const formRef = useRef<HTMLFormElement>(null);

  // Only tracked to power the commission suggestion below -- the inputs
  // themselves stay uncontrolled, so this never competes with defaultValue.
  const [listPrice, setListPrice] = useState(defaultValues?.listPrice ?? "");
  const [salePrice, setSalePrice] = useState(defaultValues?.salePrice ?? "");
  const [commissionRate, setCommissionRate] = useState(defaultValues?.commissionRate ?? "");
  const [commissionAmount, setCommissionAmount] = useState(defaultValues?.commissionAmount ?? "");
  const [brokerageSplit, setBrokerageSplit] = useState(defaultValues?.brokerageSplitPercent ?? "");
  const [referralFee, setReferralFee] = useState(defaultValues?.referralFeePercent ?? "");
  const [teamSplit, setTeamSplit] = useState(defaultValues?.teamSplitPercent ?? "");
  const [otherDeductions, setOtherDeductions] = useState(defaultValues?.otherDeductionsPercent ?? "");

  // Sale price once known, otherwise list price -- the same precedence
  // getPipelineValue uses.
  const priceForCommission = salePrice || listPrice;
  const suggestedCommission = calculateCommissionAmount(
    priceForCommission ? Number(priceForCommission) : null,
    commissionRate ? Number(commissionRate) : null,
  );

  // Live "what you actually keep". Splits used to mix a percentage with three
  // dollar fields, so entering 20 meaning 20% quietly subtracted $20 -- the
  // wrong number looked plausible and nothing on screen contradicted it.
  const grossForNet = commissionAmount ? Number(commissionAmount) : 0;
  const splitPercentTotal =
    (Number(brokerageSplit) || 0) +
    (Number(referralFee) || 0) +
    (Number(teamSplit) || 0) +
    (Number(otherDeductions) || 0);
  const showNetPreview = grossForNet > 0 && splitPercentTotal > 0;
  const netPreview = calculateNetCommission(grossForNet, {
    brokerageSplitPercent: Number(brokerageSplit) || 0,
    referralFeePercent: Number(referralFee) || 0,
    teamSplitPercent: Number(teamSplit) || 0,
    otherDeductionsPercent: Number(otherDeductions) || 0,
  });

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

      <Select
        label="Representation"
        name="side"
        defaultValue={defaultValues?.side ?? "BUYER"}
        error={state.fieldErrors?.side}
      >
        {Object.entries(DEAL_SIDE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Field
        label="Property address (optional)"
        name="propertyAddress"
        type="text"
        defaultValue={defaultValues?.propertyAddress}
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
          onChange={(e) => setListPrice(e.target.value)}
          error={state.fieldErrors?.listPrice}
        />
        <Field
          label="Sale price (optional)"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultValues?.salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
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
          onChange={(e) => setCommissionRate(e.target.value)}
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

      {/* Suggests, never overwrites. An agent on a flat fee or a negotiated
          number sees a suggestion they can ignore -- silently auto-filling
          would be wrong for them and would fight anyone who typed a real
          figure. Writing through formRef keeps every field uncontrolled, so
          this can't collide with the reset-on-create / remount-on-save logic
          above. */}
      {suggestedCommission !== null ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>
            {commissionRate}% of {formatCurrency(Number(priceForCommission))} ={" "}
            <span className="font-medium text-foreground">
              {formatCurrency(suggestedCommission)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              const input = formRef.current?.elements.namedItem("commissionAmount");
              if (input instanceof HTMLInputElement) {
                input.value = String(suggestedCommission);
              }
            }}
            className="font-medium text-accent hover:opacity-80"
          >
            Use this
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <p className="text-sm font-medium text-foreground">Commission split (optional)</p>
        <p className="-mt-2 text-sm text-muted">
          Each one is a percentage of the commission. Enter 40 for a 40% brokerage split.
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
            onChange={(e) => setBrokerageSplit(e.target.value)}
            error={state.fieldErrors?.brokerageSplitPercent}
          />
          <Field
            label="Referral fee % (optional)"
            name="referralFeePercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 25"
            defaultValue={defaultValues?.referralFeePercent}
            onChange={(e) => setReferralFee(e.target.value)}
            error={state.fieldErrors?.referralFeePercent}
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
            label="Team split % (optional)"
            name="teamSplitPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 10"
            defaultValue={defaultValues?.teamSplitPercent}
            onChange={(e) => setTeamSplit(e.target.value)}
            error={state.fieldErrors?.teamSplitPercent}
          />
          <Field
            label="Other deductions % (optional)"
            name="otherDeductionsPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 5"
            defaultValue={defaultValues?.otherDeductionsPercent}
            onChange={(e) => setOtherDeductions(e.target.value)}
            error={state.fieldErrors?.otherDeductionsPercent}
          />
        </div>

        {showNetPreview ? (
          <div className="border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">
                They take {splitPercentTotal}% of {formatCurrency(grossForNet)}
              </span>
              <span className="text-muted">
                −{formatCurrency(grossForNet - netPreview)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-medium text-foreground">You keep</span>
              <span
                className={`font-semibold ${netPreview >= 0 ? "text-accent" : "text-danger"}`}
              >
                {formatCurrency(netPreview)}
              </span>
            </div>
            {splitPercentTotal > 100 ? (
              <p className="mt-2 text-xs text-danger">
                That&apos;s more than the whole commission — check these numbers.
              </p>
            ) : null}
          </div>
        ) : null}
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
