"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { GoogleButton } from "@/components/ui/google-button";

type AccountType = "solo" | "team" | "brokerage";

// Described by what the person actually is, not by what the database calls
// them -- "brokerage" creates the same Team row a "team" does, the only real
// difference being whether the creator can change who's on the roster.
const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
  {
    value: "solo",
    label: "Just me",
    description: "An individual agent. You can join a team later.",
  },
  {
    value: "team",
    label: "My team",
    description: "You lead a team and want to see everyone's transactions.",
  },
  {
    value: "brokerage",
    label: "My brokerage or office",
    description: "You're the broker. You can add agents and manage who has access.",
  },
];

const initialState: FormState = {};

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [accountType, setAccountType] = useState<AccountType>("solo");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Track your business finances in minutes.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          required
          error={state.fieldErrors?.name}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.password}
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Who is this for?</span>
          <div className="flex flex-col gap-2">
            {ACCOUNT_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAccountType(option.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  accountType === option.value
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-surface"
                }`}
              >
                <span
                  className={`block text-sm font-medium ${
                    accountType === option.value ? "text-accent" : "text-foreground"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{option.description}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="accountType" value={accountType} />
        </div>

        {accountType !== "solo" ? (
          <Field
            label={accountType === "brokerage" ? "Brokerage name" : "Team name"}
            name="teamName"
            type="text"
            required
            error={state.fieldErrors?.teamName}
          />
        ) : null}

        <Field
          label="Your real estate license number"
          name="licenseNumber"
          type="text"
          required
          error={state.fieldErrors?.licenseNumber}
          hint="Your own salesperson license — it's how a brokerage finds you to send an invite."
        />

        {accountType === "brokerage" ? (
          <Field
            label="Brokerage license number"
            name="brokerageNumber"
            type="text"
            required
            error={state.fieldErrors?.brokerageNumber}
            hint="Your agents type this when accepting an invite, to confirm they're joining the right office."
          />
        ) : null}

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <GoogleButton label="Sign up with Google" />
        <p className="text-center text-xs text-muted">
          Creates a solo account — use the form above for a team or brokerage instead.
        </p>
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:opacity-80">
          Log in
        </Link>
      </p>
    </div>
  );
}
