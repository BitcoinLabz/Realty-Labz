"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAssetAction, updateAssetAction } from "@/app/actions/assets";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { AssetType, WalletNetwork } from "./types";

const initialState: FormState = {};

export type AssetFormValues = {
  id?: string;
  name: string;
  type: AssetType;
  currentValue: string;
  notes: string;
  walletNetwork?: WalletNetwork | null;
  walletAddress?: string | null;
  stockTicker?: string | null;
  shareCount?: string | null;
};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

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
  const [type, setType] = useState<AssetType>(defaultValues?.type ?? "STOCKS");
  const [trackWallet, setTrackWallet] = useState(!!defaultValues?.walletNetwork);
  const [network, setNetwork] = useState<WalletNetwork>(defaultValues?.walletNetwork ?? "BITCOIN");
  const [trackStock, setTrackStock] = useState(!!defaultValues?.stockTicker);
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      if (!isEdit) {
        formRef.current?.reset();
        setType("STOCKS");
        setTrackWallet(false);
        setTrackStock(false);
      }
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  const isCrypto = type === "CRYPTO";
  const isStock = type === "STOCKS";

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
        value={type}
        onChange={(e) => setType(e.target.value as AssetType)}
        error={state.fieldErrors?.type}
      >
        <option value="STOCKS">Stocks</option>
        <option value="RETIREMENT">Retirement</option>
        <option value="REAL_ESTATE">Real estate</option>
        <option value="CRYPTO">Crypto</option>
        <option value="SAVINGS">Savings</option>
        <option value="OTHER">Other</option>
      </Select>

      {isCrypto ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Value source</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTrackWallet(false)}
              className={pillClass(!trackWallet)}
            >
              Enter manually
            </button>
            <button type="button" onClick={() => setTrackWallet(true)} className={pillClass(trackWallet)}>
              Track a wallet
            </button>
          </div>
        </div>
      ) : null}

      {isStock ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Value source</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTrackStock(false)}
              className={pillClass(!trackStock)}
            >
              Enter manually
            </button>
            <button type="button" onClick={() => setTrackStock(true)} className={pillClass(trackStock)}>
              Track shares
            </button>
          </div>
        </div>
      ) : null}

      {isCrypto && trackWallet ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Network</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNetwork("BITCOIN")}
                className={pillClass(network === "BITCOIN")}
              >
                Bitcoin
              </button>
              <button
                type="button"
                onClick={() => setNetwork("STACKS")}
                className={pillClass(network === "STACKS")}
              >
                Stacks
              </button>
            </div>
            <input type="hidden" name="walletNetwork" value={network} />
          </div>
          <Field
            label="Wallet address"
            name="walletAddress"
            type="text"
            placeholder={network === "BITCOIN" ? "bc1q…" : "SP…"}
            defaultValue={defaultValues?.walletAddress ?? ""}
            required
            error={state.fieldErrors?.walletAddress}
          />
          <p className="-mt-2 text-sm text-muted">
            The balance is fetched from the public blockchain and converted to USD when you add or
            refresh it — not updated live.
          </p>
        </>
      ) : isStock && trackStock ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Ticker symbol"
              name="stockTicker"
              type="text"
              placeholder="e.g. AAPL"
              defaultValue={defaultValues?.stockTicker ?? ""}
              required
              error={state.fieldErrors?.stockTicker}
            />
            <Field
              label="Number of shares"
              name="shareCount"
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g. 12.5"
              defaultValue={defaultValues?.shareCount ?? ""}
              required
              error={state.fieldErrors?.shareCount}
            />
          </div>
          <p className="-mt-2 text-sm text-muted">
            The share price is looked up and multiplied by your share count when you add or refresh
            it — not updated live.
          </p>
        </>
      ) : (
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
      )}

      <Field
        label="Notes (optional)"
        name="notes"
        type="text"
        defaultValue={defaultValues?.notes ?? undefined}
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
