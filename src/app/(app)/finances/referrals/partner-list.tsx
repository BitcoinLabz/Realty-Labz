"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileWarning } from "lucide-react";
import {
  createReferralPartnerAction,
  deleteReferralPartnerAction,
  setReferralW9Action,
  updateReferralPartnerAction,
} from "@/app/actions/referral-partners";
import type { FormState } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";

export type PartnerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  w9Received: boolean;
  yearTotal: number;
  lifetimeTotal: number;
  needs1099: boolean;
};

const initialState: FormState = {};

function PartnerForm({ partner, onDone }: { partner?: PartnerRow; onDone?: () => void }) {
  const [state, formAction, isPending] = useActionState(
    partner ? updateReferralPartnerAction : createReferralPartnerAction,
    initialState,
  );
  const [formKey, setFormKey] = useState(0);
  const last = useRef(state);

  useEffect(() => {
    if (state !== last.current && state.success) {
      if (onDone) onDone();
      else setFormKey((k) => k + 1);
    }
    last.current = state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3">
      {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={partner?.name} required error={state.fieldErrors?.name} />
        <Field label="Email (optional)" name="email" type="email" defaultValue={partner?.email ?? ""} error={state.fieldErrors?.email} />
        <Field label="Phone (optional)" name="phone" type="tel" defaultValue={partner?.phone ?? ""} error={state.fieldErrors?.phone} />
        <Field label="Note (optional)" name="notes" defaultValue={partner?.notes ?? ""} placeholder="e.g. Brokerage, payment details" />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant={partner ? "primary" : "secondary"} disabled={isPending}>
          {isPending ? "Saving…" : partner ? "Save" : "Add partner"}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function W9Switch({ id, received }: { id: string; received: boolean }) {
  return (
    <form action={setReferralW9Action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="received" value={received ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={received}
        className="flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground"
      >
        <span className="whitespace-nowrap">W-9 on file</span>
        <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${received ? "bg-success" : "bg-border"}`}>
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${received ? "translate-x-[18px]" : "translate-x-0.5"}`}
          />
        </span>
      </button>
    </form>
  );
}

function PartnerItem({ partner, year }: { partner: PartnerRow; year: number }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-accent p-4">
        <PartnerForm partner={partner} onDone={() => setEditing(false)} />
        <form
          action={deleteReferralPartnerAction}
          onSubmit={(e) => {
            if (!confirm(`Remove ${partner.name}? Transactions keep their referral fee; they just won't name a partner.`))
              e.preventDefault();
          }}
          className="border-t border-border pt-3"
        >
          <input type="hidden" name="id" value={partner.id} />
          <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
            Remove partner
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{partner.name}</span>
          {partner.email || partner.phone ? (
            <span className="truncate text-xs text-muted">{[partner.email, partner.phone].filter(Boolean).join(" · ")}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(partner.yearTotal)}</span>
          <span className="text-xs text-muted">in {year} · {formatCurrency(partner.lifetimeTotal)} all time</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {partner.needs1099 ? (
            <Badge tone={partner.w9Received ? "warning" : "danger"} icon={FileWarning}>
              {partner.w9Received ? "1099 likely needed" : "1099 likely needed · get a W-9"}
            </Badge>
          ) : null}
          <W9Switch id={partner.id} received={partner.w9Received} />
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-muted hover:text-foreground">
          Edit
        </button>
      </div>
    </div>
  );
}

export function PartnerList({ partners, year }: { partners: PartnerRow[]; year: number }) {
  return (
    <div className="flex flex-col gap-6">
      {partners.length === 0 ? (
        <p className="text-sm text-muted">
          No referral partners yet. Add the agents and brokerages you send or receive referrals with, then
          pick one on a transaction&apos;s details.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {partners.map((p) => (
            <PartnerItem key={p.id} partner={p} year={year} />
          ))}
        </div>
      )}
      <div className="max-w-2xl border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Add a referral partner</h3>
        <PartnerForm />
      </div>
    </div>
  );
}
