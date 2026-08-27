"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  addVisitorAsClientAction,
  createOpenHouseAction,
  deleteOpenHouseAction,
} from "@/app/actions/open-houses";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { OpenHouseDTO } from "../types";

const initialState: FormState = {};

function AddOpenHouseForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(createOpenHouseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Date" name="date" type="date" required error={state.fieldErrors?.date} />
        <Field
          label="Start time"
          name="startTime"
          type="time"
          required
          error={state.fieldErrors?.startTime}
        />
        <Field label="End time" name="endTime" type="time" required error={state.fieldErrors?.endTime} />
      </div>
      <Textarea label="Notes (optional)" name="notes" error={state.fieldErrors?.notes} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Scheduling…" : "Schedule open house"}
        </Button>
      </div>
    </form>
  );
}

function CopyLinkButton({ openHouseId }: { openHouseId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        const url = `${window.location.origin}/open-house/${openHouseId}`;
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-sm font-medium text-accent hover:opacity-80"
    >
      {copied ? "Copied!" : "Copy sign-in link"}
    </button>
  );
}

export function OpenHouseSection({
  dealId,
  openHouses,
}: {
  dealId: string;
  openHouses: OpenHouseDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {openHouses.length === 0 ? (
        <p className="text-sm text-muted">
          No open houses scheduled yet. Schedule one below, then share its sign-in link.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {openHouses.map((oh) => (
            <div key={oh.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {new Date(oh.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {oh.startTime}–{oh.endTime}
                  </span>
                  <span className="text-sm text-muted">
                    {oh.visitors.length} sign-in{oh.visitors.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <CopyLinkButton openHouseId={oh.id} />
                  <form
                    action={deleteOpenHouseAction}
                    onSubmit={(e) => {
                      if (!confirm("Delete this open house? Sign-ins will be deleted too.")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={oh.id} />
                    <input type="hidden" name="dealId" value={dealId} />
                    <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              {oh.visitors.length > 0 ? (
                <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
                  {oh.visitors.map((v) => (
                    <div key={v.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{v.name}</span>
                        {v.interested !== null ? (
                          <span className={v.interested ? "text-accent" : "text-muted"}>
                            {v.interested ? "Interested" : "Not interested"}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-muted">
                        {[v.email, v.phone].filter(Boolean).join(" · ") || "No contact info"}
                      </span>
                      {v.feedback ? <p className="mt-1 text-muted">&ldquo;{v.feedback}&rdquo;</p> : null}
                      <div className="mt-1.5">
                        {v.existingClientId ? (
                          <Link
                            href={`/clients/${v.existingClientId}`}
                            className="text-sm font-medium text-muted hover:text-foreground"
                          >
                            Already a client →
                          </Link>
                        ) : (
                          <form action={addVisitorAsClientAction}>
                            <input type="hidden" name="visitorId" value={v.id} />
                            <input type="hidden" name="dealId" value={dealId} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:opacity-80"
                            >
                              <UserPlus size={14} />
                              Add as a client
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Schedule an open house</h3>
        <AddOpenHouseForm dealId={dealId} />
      </div>
    </div>
  );
}
