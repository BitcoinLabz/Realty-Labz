"use client";

import { EyeOff, Users } from "lucide-react";
import { setDealSharingAction } from "@/app/actions/deals";

// One switch, owner-only (see setDealSharingAction). On by default: a broker
// is accountable for files under their license, so hiding is the exception
// the agent chooses, not the norm.
export function ShareWithBrokerage({ dealId, shared }: { dealId: string; shared: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-start gap-3">
        {shared ? (
          <Users size={18} className="mt-0.5 shrink-0 text-accent" />
        ) : (
          <EyeOff size={18} className="mt-0.5 shrink-0 text-warning" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Share with my brokerage</p>
          <p className="text-sm text-muted">
            {shared
              ? "Your brokerage can see this transaction, its deadlines and its documents. Only you can change it."
              : "Your brokerage can't see this transaction. They'll see that one of your files isn't shared, but not which."}
          </p>
        </div>
      </div>
      <form action={setDealSharingAction} className="shrink-0 self-start sm:self-auto">
        <input type="hidden" name="id" value={dealId} />
        <input type="hidden" name="shared" value={shared ? "false" : "true"} />
        <button
          type="submit"
          role="switch"
          aria-checked={shared}
          aria-label="Share with my brokerage"
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            shared ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
              shared ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </form>
    </section>
  );
}
