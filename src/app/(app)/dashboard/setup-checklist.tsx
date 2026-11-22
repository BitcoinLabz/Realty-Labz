"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated, useLocalStorageValue } from "@/lib/use-hydrated";
import { Sparkles } from "lucide-react";

const DISMISS_KEY = "realtylabz:setup-checklist-dismissed";

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  done: boolean;
};

// Shown to brand-new users, who previously landed on six $0.00 tiles and
// "Nothing due in the next 7 days" with no idea what the app does or where
// to start.
//
// Every step's `done` is computed from data the dashboard already fetches --
// no schema field, no migration, nothing to keep in sync. The card
// disappears on its own once all four are done; the Dismiss link is
// localStorage-only (per browser) for people who'd rather get on with it.
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  // Start hidden and reveal after mount: reading localStorage during render
  // would mismatch the server-rendered HTML and cause a hydration error.
  const mounted = useHydrated();
  const stored = useLocalStorageValue(DISMISS_KEY);
  const [dismissedNow, setDismissed] = useState(false);
  const dismissed = dismissedNow || stored === "true";

  const remaining = steps.filter((s) => !s.done);
  if (!mounted || dismissed || remaining.length === 0) return null;

  const doneCount = steps.length - remaining.length;

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles size={15} className="text-accent" />
          {doneCount} of {steps.length} done
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
          className="shrink-0 text-xs font-medium text-muted hover:text-foreground"
        >
          Hide
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {remaining.map((step) => (
          <div
            key={step.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-xs text-muted">{step.description}</p>
            </div>
            <Link
              href={step.href}
              className="inline-flex min-h-11 shrink-0 items-center self-start rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground sm:self-auto"
            >
              {step.actionLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
