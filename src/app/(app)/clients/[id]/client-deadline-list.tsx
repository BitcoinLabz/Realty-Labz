"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createClientDeadlineAction,
  deleteClientDeadlineAction,
  toggleClientDeadlineAction,
} from "@/app/actions/client-deadlines";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ClientDeadlineDTO } from "../types";

const initialState: FormState = {};

function AddClientDeadlineForm({ clientId }: { clientId: string }) {
  const [state, formAction, isPending] = useActionState(createClientDeadlineAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="flex-1">
        <Field
          label="Reminder"
          name="label"
          type="text"
          placeholder="e.g. Send pre-approval letter"
          required
          error={state.fieldErrors?.label}
        />
      </div>
      <div className="sm:w-44">
        <Field label="Due date" name="dueDate" type="date" required error={state.fieldErrors?.dueDate} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending} className="shrink-0">
        {isPending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

export function ClientDeadlineList({
  clientId,
  deadlines,
}: {
  clientId: string;
  deadlines: ClientDeadlineDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <AddClientDeadlineForm clientId={clientId} />

      {deadlines.length === 0 ? (
        <p className="text-sm text-muted">
          No reminders yet — e.g. a document to collect or a follow-up call, not tied to a
          specific property.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {deadlines.map((d) => {
            const isDone = !!d.completedAt;
            const isOverdue = !isDone && new Date(d.dueDate + "T00:00:00") < new Date();
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <form action={toggleClientDeadlineAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="clientId" value={clientId} />
                    <input type="hidden" name="isCompleted" value={String(isDone)} />
                    <button
                      type="submit"
                      aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        isDone ? "border-accent bg-accent text-accent-foreground" : "border-border"
                      }`}
                    >
                      {isDone ? "✓" : ""}
                    </button>
                  </form>
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${
                        isDone ? "text-muted line-through" : "text-foreground"
                      }`}
                    >
                      {d.label}
                    </span>
                    <span className={`text-sm ${isOverdue ? "text-danger" : "text-muted"}`}>
                      {new Date(d.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {isOverdue ? " · Overdue" : ""}
                    </span>
                  </div>
                </div>
                <form action={deleteClientDeadlineAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="clientId" value={clientId} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
