"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { saveEligibilityAction } from "@/app/actions/home-office";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

type Answer = "yes" | "no" | "";

const QUESTIONS: { name: "regularUse" | "exclusiveUse" | "principalPlace"; question: string; explain: string }[] = [
  {
    name: "regularUse",
    question: "Do you use this space for your real estate work regularly?",
    explain: "Steady, ongoing use — not just now and then.",
  },
  {
    name: "exclusiveUse",
    question: "Is it used only for work?",
    explain: "A desk in the guest room the family also uses doesn't count. A spare room that's only your office does.",
  },
  {
    name: "principalPlace",
    question: "Do you do your paperwork and admin here, with no other fixed place for it?",
    explain:
      "Most agents qualify even with a brokerage desk, as long as the brokerage isn't where you do most of your admin work (scheduling, marketing, bookkeeping).",
  },
];

const initialState: FormState = {};

export function EligibilityForm({ answers }: { answers: Record<(typeof QUESTIONS)[number]["name"], Answer> }) {
  const [state, formAction, isPending] = useActionState(saveEligibilityAction, initialState);
  const [values, setValues] = useState(answers);

  const answered = QUESTIONS.every((q) => values[q.name] !== "");
  const qualifies = QUESTIONS.every((q) => values[q.name] === "yes");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {QUESTIONS.map((q) => (
        <fieldset key={q.name} className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">{q.question}</legend>
          <p className="text-sm text-muted">{q.explain}</p>
          <input type="hidden" name={q.name} value={values[q.name]} />
          <div className="mt-1 grid w-full grid-cols-2 gap-2 sm:w-56">
            {(["yes", "no"] as const).map((option) => {
              const active = values[q.name] === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setValues((v) => ({ ...v, [q.name]: option }))}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors ${
                    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
                  }`}
                >
                  {option === "yes" ? "Yes" : "No"}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {answered ? (
        qualifies ? (
          <p className="flex items-start gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            Your space looks like it qualifies for a home office deduction.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            Based on your answers, this space may not qualify. The IRS requires all three. You can still keep records
            here, but check with your accountant before claiming it.
          </p>
        )
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Saving…" : "Save answers"}
        </Button>
      </div>
    </form>
  );
}
