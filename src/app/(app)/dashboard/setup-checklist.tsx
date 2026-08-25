"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
    setMounted(true);
  }, []);

  const remaining = steps.filter((s) => !s.done);
  if (!mounted || dismissed || remaining.length === 0) return null;

  const doneCount = steps.length - remaining.length;

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-6 sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles size={17} className="text-accent" />
            Let&apos;s get you set up
          </h2>
          <p className="mt-1 text-sm text-muted">
            {doneCount} of {steps.length} done — each one takes about a minute.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
          className="shrink-0 text-sm font-medium text-muted hover:text-foreground"
        >
          Hide this
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? "border-accent bg-accent text-accent-foreground" : "border-border"
                }`}
                aria-hidden="true"
              >
                {step.done ? <Check size={13} strokeWidth={3} /> : null}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.done ? "text-muted line-through" : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            </div>
            {!step.done ? (
              <Link
                href={step.href}
                className="shrink-0 self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:self-auto"
              >
                {step.actionLabel}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
