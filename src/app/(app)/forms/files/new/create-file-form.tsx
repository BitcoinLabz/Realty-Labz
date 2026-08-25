"use client";

import { useActionState, useState } from "react";
import { createFileAction } from "@/app/actions/deals";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { DEAL_SIDE_LABELS } from "../../../deals/types";
import type { ClientOption } from "../../types";

const initialState: FormState = {};

function pillClass(active: boolean) {
  return `rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
  }`;
}

export function CreateFileForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, isPending] = useActionState(createFileAction, initialState);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");
  const [emailReminders, setEmailReminders] = useState(true);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Representation</h2>
        <div className="max-w-md">
          <Select
            label="Who are you representing?"
            name="side"
            defaultValue="BUYER"
            error={state.fieldErrors?.side}
          >
            {Object.entries(DEAL_SIDE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Who is the client?</h2>
        <div className="flex max-w-md flex-col gap-4">
          {clients.length > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClientMode("existing")}
                className={pillClass(clientMode === "existing")}
              >
                Existing client
              </button>
              <button
                type="button"
                onClick={() => setClientMode("new")}
                className={pillClass(clientMode === "new")}
              >
                New client
              </button>
            </div>
          ) : null}
          <input type="hidden" name="clientMode" value={clientMode} />

          {clientMode === "existing" && clients.length > 0 ? (
            <Select label="Client" name="clientId" defaultValue="" error={state.fieldErrors?.clientId}>
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <Field
                label="Name"
                name="newClientName"
                type="text"
                required
                error={state.fieldErrors?.newClientName}
              />
              <Field
                label="Email (optional)"
                name="newClientEmail"
                type="email"
                error={state.fieldErrors?.newClientEmail}
              />
              <Field
                label="Phone (optional)"
                name="newClientPhone"
                type="tel"
                error={state.fieldErrors?.newClientPhone}
              />
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={emailReminders}
                  onChange={(e) => setEmailReminders(e.target.checked)}
                  className="mt-1"
                />
                Email them as contract deadlines approach
              </label>
              <input
                type="hidden"
                name="emailDeadlineReminders"
                value={emailReminders ? "true" : "false"}
              />
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Is there a property yet?</h2>
        <p className="mb-6 text-sm text-muted">
          Optional — add this later once one is found.
        </p>
        <div className="flex max-w-md flex-col gap-4">
          <Field
            label="Property address (optional)"
            name="propertyAddress"
            type="text"
            error={state.fieldErrors?.propertyAddress}
          />
          <div>
            <Field
              label="MLS # (optional)"
              name="mlsNumber"
              type="text"
              error={state.fieldErrors?.mlsNumber}
            />
            <p className="mt-1.5 text-sm text-muted">
              For your own reference — automatic MLS lookup isn&apos;t available yet.
            </p>
          </div>
        </div>
      </section>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create file"}
        </Button>
      </div>
    </form>
  );
}
