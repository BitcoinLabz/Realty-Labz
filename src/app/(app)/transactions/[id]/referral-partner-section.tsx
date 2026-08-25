"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createReferralPartnerAction,
  deleteReferralPartnerAction,
} from "@/app/actions/referral-partners";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";
import type { ReferralPartnerDTO } from "../types";

const initialState: FormState = {};

function AddPartnerForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(createReferralPartnerAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="returnToDealId" value={dealId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" type="text" required error={state.fieldErrors?.name} />
        <Field label="Email (optional)" name="email" type="email" error={state.fieldErrors?.email} />
      </div>
      <Field label="Phone (optional)" name="phone" type="tel" error={state.fieldErrors?.phone} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Adding…" : "Add referral partner"}
        </Button>
      </div>
    </form>
  );
}

export function ReferralPartnerSection({
  dealId,
  partners,
}: {
  dealId: string;
  partners: ReferralPartnerDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Contacts you trade referrals with — pick one on this deal above to attribute its referral
        fee. Totals below are lifetime, from closed deals only.
      </p>

      {partners.length === 0 ? (
        <p className="text-sm text-muted">Nobody added yet. If another agent sends you business, add them here to keep track of what you owe them.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {partners.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="text-sm text-muted">
                  {[p.email, p.phone].filter(Boolean).join(" · ") || "No contact info"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(p.totalOwed)} owed
                </span>
                <form
                  action={deleteReferralPartnerAction}
                  onSubmit={(e) => {
                    if (!confirm(`Delete ${p.name}?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="returnToDealId" value={dealId} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Add a referral partner</h3>
        <AddPartnerForm dealId={dealId} />
      </div>
    </div>
  );
}
