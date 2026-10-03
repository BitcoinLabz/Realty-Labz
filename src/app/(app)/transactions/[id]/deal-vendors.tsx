"use client";

import { useRef } from "react";
import { Mail, Phone, Store } from "lucide-react";
import { attachVendorAction, detachVendorAction } from "@/app/actions/deal-vendors";
import { Card } from "@/components/ui/card";
import { VENDOR_KIND_LABELS } from "@/lib/vendor-kinds";

export type DealVendorDTO = {
  id: string;
  kind: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

// Everyone on the file in one place: the office's title company, lender,
// inspector, sign installer. One tap to call or email -- the reason this
// exists is that nobody retypes the title company's number again.
export function DealVendors({
  dealId,
  attached,
  directory,
  canEdit,
}: {
  dealId: string;
  attached: DealVendorDTO[];
  directory: DealVendorDTO[];
  canEdit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const attachedIds = new Set(attached.map((v) => v.id));
  const available = directory.filter((v) => !attachedIds.has(v.id));
  const kinds = Object.keys(VENDOR_KIND_LABELS).filter((k) => available.some((v) => v.kind === k));

  // Nothing to show and nothing to attach: stay out of the way.
  if (attached.length === 0 && (!canEdit || available.length === 0)) return null;

  return (
    <Card title="Vendors" icon={Store} tone="violet" description="Title, lender, inspector and others on this file.">
      <div className="flex flex-col gap-3">
        {attached.length === 0 ? <p className="text-sm text-muted">None attached yet.</p> : null}
        {attached.map((v) => (
          <div key={v.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{v.name}</span>
              <span className="text-xs text-muted">
                {VENDOR_KIND_LABELS[v.kind]}
                {v.contactName ? ` · ${v.contactName}` : ""}
              </span>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {v.phone ? (
                  <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    <Phone size={12} />
                    {v.phone}
                  </a>
                ) : null}
                {v.email ? (
                  <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1 break-all text-xs font-medium text-accent">
                    <Mail size={12} />
                    {v.email}
                  </a>
                ) : null}
              </div>
              {v.notes ? <span className="text-xs text-muted">{v.notes}</span> : null}
            </div>
            {canEdit ? (
              <form action={detachVendorAction} className="shrink-0">
                <input type="hidden" name="dealId" value={dealId} />
                <input type="hidden" name="vendorId" value={v.id} />
                <button type="submit" className="text-sm font-medium text-muted hover:text-danger">
                  Remove
                </button>
              </form>
            ) : null}
          </div>
        ))}

        {canEdit && available.length > 0 ? (
          <form ref={formRef} action={attachVendorAction}>
            <input type="hidden" name="dealId" value={dealId} />
            <select
              name="vendorId"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) formRef.current?.requestSubmit();
              }}
              aria-label="Attach a vendor"
              className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">+ Attach a vendor from your office…</option>
              {kinds.map((kind) => (
                <optgroup key={kind} label={VENDOR_KIND_LABELS[kind]}>
                  {available
                    .filter((v) => v.kind === kind)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
