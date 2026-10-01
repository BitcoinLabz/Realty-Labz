"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { uploadAndReadContractAction, type AnalysisState } from "@/app/actions/contract-analysis";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { ReviewPanel } from "./contract-analyzer";

const initialState: AnalysisState = {};

// The one obvious place to hand over a contract: drop the PDF, it's filed on
// this transaction and read in the same step, and the review screen opens
// right here. Replaces "upload in Documents, then find a separate read
// button" -- two places for what an agent thinks of as one job.
//
// Shown even when AI reading isn't configured, as a calm "not switched on"
// card, so the feature is discoverable rather than silently absent.
export function ContractAssistant({
  dealId,
  enabled,
  hasDeadlines,
}: {
  dealId: string;
  enabled: boolean;
  hasDeadlines: boolean;
}) {
  const [state, formAction, isPending] = useActionState(uploadAndReadContractAction, initialState);
  // Each read produces a new state object; remember which one was reviewed
  // so applying or discarding closes it without a reset.
  const [closedFor, setClosedFor] = useState<AnalysisState | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const reviewing = !!state.extracted && closedFor !== state;

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Sparkles size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Contract assistant</h2>
          <p className="mt-1 text-sm text-muted">
            {hasDeadlines
              ? "Got an amended or countered contract? Drop it in to pick up any new dates."
              : "Drop in the purchase agreement. It finds every deadline, shows you the line each one came from, flags anything worth a second look, and sets up your client's reminders."}{" "}
            You check everything before it&apos;s saved.
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted">
          Contract reading isn&apos;t switched on for this site yet. It needs an Anthropic API key
          added in Vercel as <span className="font-medium text-foreground">ANTHROPIC_API_KEY</span>,
          then a redeploy.
        </div>
      ) : reviewing ? (
        <ReviewPanel
          dealId={dealId}
          extracted={state.extracted!}
          onDone={(message) => {
            setClosedFor(state);
            setConfirmation(message ?? null);
          }}
        />
      ) : (
        <form
          action={formAction}
          onSubmit={() => setConfirmation(null)}
          className="flex max-w-md flex-col gap-4"
        >
          <input type="hidden" name="dealId" value={dealId} />

          {confirmation ? (
            <p className="flex items-start gap-2 rounded-xl bg-surface p-4 text-sm text-foreground">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
              {confirmation}
            </p>
          ) : null}

          <FileDropInput
            id="contract-assistant-file"
            label="Contract PDF"
            accept=".pdf,application/pdf"
            required
            helperText="Saved to this transaction's documents, then read. Usually under a minute."
            error={state.fieldErrors?.file}
          />

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Reading your contract…" : "Read contract"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
