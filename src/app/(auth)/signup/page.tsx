"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signupAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { GoogleButton } from "@/components/ui/google-button";

const initialState: FormState = {};

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [accountType, setAccountType] = useState<"solo" | "team">("solo");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Track your business finances in minutes.</p>
      </div>

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
        <span className="text-sm font-medium text-foreground">Account type</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountType("solo")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              accountType === "solo"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground hover:bg-surface"
            }`}
          >
            Just me
          </button>
          <button
            type="button"
            onClick={() => setAccountType("team")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              accountType === "team"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground hover:bg-surface"
            }`}
          >
            Start a team
          </button>
        </div>
        <input type="hidden" name="accountType" value={accountType} />
      </div>

      {accountType === "team" ? (
        <Field
          label="Team / brokerage name"
          name="teamName"
          type="text"
          required
          error={state.fieldErrors?.teamName}
        />
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <div className="flex flex-col gap-2">
        <GoogleButton label="Sign up with Google" />
        <p className="text-center text-xs text-muted">
          Creates a solo account — use the form above to start a team instead.
        </p>
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:opacity-80">
          Log in
        </Link>
      </p>
    </form>
  );
}
