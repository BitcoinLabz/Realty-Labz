"use client";

import { Mail } from "lucide-react";
import { setDailyDigestAction } from "@/app/actions/account";

export function DigestToggle({ on }: { on: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Mail size={18} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-sm text-muted">
          A short email each morning with overdue dates, office tasks due, missing paperwork and this
          week&apos;s closings. Only sent on days with something in it.
        </p>
      </div>
      <form action={setDailyDigestAction} className="shrink-0 self-start sm:self-auto">
        <input type="hidden" name="on" value={on ? "false" : "true"} />
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-label="Morning email"
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${on ? "bg-accent" : "bg-border"}`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`}
          />
        </button>
      </form>
    </div>
  );
}
