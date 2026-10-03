"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { deleteVendorAction, saveVendorAction } from "@/app/actions/office-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { VENDOR_KIND_LABELS } from "@/lib/vendor-kinds";

export type VendorDTO = {
  id: string;
  kind: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

const initialState: FormState = {};

function VendorForm({ vendor, onDone }: { vendor?: VendorDTO; onDone?: () => void }) {
  const [state, formAction, isPending] = useActionState(saveVendorAction, initialState);
  const [formKey, setFormKey] = useState(0);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current && state.success) {
      if (onDone) onDone();
      else setFormKey((k) => k + 1); // adding: clear for the next one
    }
    lastState.current = state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3">
      {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Type" name="kind" defaultValue={vendor?.kind ?? "TITLE"} error={state.fieldErrors?.kind}>
          {Object.entries(VENDOR_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Field label="Company" name="name" defaultValue={vendor?.name} required error={state.fieldErrors?.name} />
        <Field label="Contact (optional)" name="contactName" defaultValue={vendor?.contactName ?? ""} />
        <Field label="Phone (optional)" name="phone" type="tel" defaultValue={vendor?.phone ?? ""} />
        <Field
          label="Email (optional)"
          name="email"
          type="email"
          defaultValue={vendor?.email ?? ""}
          error={state.fieldErrors?.email}
        />
        <Field label="Note (optional)" name="notes" defaultValue={vendor?.notes ?? ""} placeholder="e.g. Ask for the closing team" />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant={vendor ? "primary" : "secondary"} disabled={isPending}>
          {isPending ? "Saving…" : vendor ? "Save" : "Add vendor"}
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

function VendorRow({ vendor }: { vendor: VendorDTO }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-accent p-4">
        <VendorForm vendor={vendor} onDone={() => setEditing(false)} />
        <form
          action={deleteVendorAction}
          onSubmit={(e) => {
            if (!confirm(`Remove ${vendor.name}? It comes off any files it's attached to.`)) e.preventDefault();
          }}
          className="border-t border-border pt-3"
        >
          <input type="hidden" name="id" value={vendor.id} />
          <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
            Remove vendor
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{vendor.name}</span>
        <span className="text-xs text-muted">
          {VENDOR_KIND_LABELS[vendor.kind]}
          {vendor.contactName ? ` · ${vendor.contactName}` : ""}
        </span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {vendor.phone ? (
            <a href={`tel:${vendor.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              <Phone size={12} />
              {vendor.phone}
            </a>
          ) : null}
          {vendor.email ? (
            <a href={`mailto:${vendor.email}`} className="inline-flex items-center gap-1 break-all text-xs font-medium text-accent">
              <Mail size={12} />
              {vendor.email}
            </a>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-medium text-muted hover:text-foreground">
        Edit
      </button>
    </div>
  );
}

export function VendorSettings({ vendors }: { vendors: VendorDTO[] }) {
  return (
    <div className="flex flex-col gap-6">
      {vendors.length === 0 ? (
        <p className="text-sm text-muted">
          No vendors yet. Add your office&apos;s go-to title company, lenders, inspectors and sign
          installer — agents can then attach them to a file in one tap.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {vendors.map((v) => (
            <VendorRow key={v.id} vendor={v} />
          ))}
        </div>
      )}
      <div className="max-w-2xl border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Add a vendor</h3>
        <VendorForm />
      </div>
    </div>
  );
}
