"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { analyzeContractAction, type AnalysisState } from "@/app/actions/contract-analysis";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DocumentDTO } from "@/app/(app)/clients/types";
import { ReviewPanel } from "./contract-analyzer";

const initialState: AnalysisState = {};

// The one place a contract gets read. It deliberately has no upload box of
// its own: the transaction's Documents tab is the only place files go in, so
// there's never a question of which upload to use. This card just picks one
// of those PDFs (newest first) and opens the review right here.
//
// Shown even when AI reading isn't configured, as a calm "not switched on"
// card, so the feature is discoverable rather than silently absent.
export function ContractAssistant({
  dealId,
  enabled,
  hasDeadlines,
  documents,
}: {
  dealId: string;
  enabled: boolean;
  hasDeadlines: boolean;
  documents: DocumentDTO[]; // newest first
}) {
  const [state, formAction, isPending] = useActionState(analyzeContractAction, initialState);
  // Each read produces a new state object; remember which one was reviewed
  // so applying or discarding closes it without a reset.
  const [closedFor, setClosedFor] = useState<AnalysisState | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const pdfs = documents.filter((d) => d.mimeType === "application/pdf");
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
              ? "Got an amended or countered contract? Read it to pick up any new dates."
              : "Reads your purchase agreement, finds every deadline, shows you the line each one came from, flags anything worth a second look, and sets up your client's reminders."}{" "}
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
      ) : pdfs.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <FileText size={16} className="shrink-0 text-muted" />
            Upload the purchase agreement as a PDF, then come back here to read it.
          </p>
          <a href="#documents" className="text-sm font-medium text-accent hover:opacity-80">
            Go to Documents →
          </a>
        </div>
      ) : (
        <form action={formAction} onSubmit={() => setConfirmation(null)} className="flex max-w-md flex-col gap-4">
          <input type="hidden" name="dealId" value={dealId} />

          {confirmation ? (
            <p className="flex items-start gap-2 rounded-xl bg-surface p-4 text-sm text-foreground">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
              {confirmation}
            </p>
          ) : null}

          {pdfs.length === 1 ? (
            <>
              <input type="hidden" name="documentId" value={pdfs[0].id} />
              <p className="flex items-center gap-2 text-sm text-foreground">
                <FileText size={16} className="shrink-0 text-muted" />
                <span className="min-w-0 break-words">{pdfs[0].fileName}</span>
              </p>
            </>
          ) : (
            <Select label="Contract to read" name="documentId" defaultValue={pdfs[0].id}>
              {pdfs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName}
                </option>
              ))}
            </Select>
          )}

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Reading your contract…" : "Read contract"}
            </Button>
          </div>
          {isPending ? <p className="text-xs text-muted">Usually under a minute.</p> : null}
        </form>
      )}
    </section>
  );
}
