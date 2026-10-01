"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus, CheckCircle2, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { analyzeContractAction, type AnalysisState, type ApplyResult } from "@/app/actions/contract-analysis";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ExistingDeadline } from "@/lib/contract-checks";
import type { DocumentDTO } from "@/app/(app)/clients/types";
import { ReviewPanel } from "./contract-analyzer";

const initialState: AnalysisState = {};

// Reading a contract takes 30-60 seconds; a single frozen label for that long
// feels broken. These advance on a timer -- honest about the wait without
// pretending to track real progress.
const READING_STEPS = ["Reading the contract…", "Finding the dates…", "Checking for anything unusual…"];

function ReadingProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, READING_STEPS.length - 1)), 12000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {READING_STEPS[step]} Usually under a minute.
    </p>
  );
}

// After a save: what happened, in a sentence, and the obvious next step.
function SavedSummary({ result, dealId }: { result: ApplyResult; dealId: string }) {
  const parts = [];
  if (result.added > 0) parts.push(`added ${result.added}`);
  if (result.updated > 0) parts.push(`updated ${result.updated}`);
  const total = result.added + result.updated;
  const what =
    parts.length === 0
      ? "Saved the contract details."
      : `${parts.join(" and ").replace(/^./, (c) => c.toUpperCase())} deadline${total === 1 ? "" : "s"}.`;

  const c = result.client;
  const reminders =
    total === 0
      ? null
      : c && c.hasEmail && c.remindersOn
        ? `${c.name} will get a reminder 3 days before each one and again the day before. You're copied.`
        : "You'll get a reminder 3 days before each one and again the day before.";

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
        <span>
          {what} {reminders}
        </span>
      </p>
      <div className="ml-6 flex flex-wrap gap-x-5 gap-y-2">
        {total > 0 ? (
          <a
            href={`/api/calendar/transactions/${dealId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80"
          >
            <CalendarPlus size={14} />
            Add to calendar
          </a>
        ) : null}
        {c && !c.hasEmail && total > 0 ? (
          <Link href={`/clients/${c.id}`} className="text-sm font-medium text-accent hover:opacity-80">
            Add {c.name}&apos;s email so they get reminders →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// The one place a contract gets read. It deliberately has no upload box of
// its own: the transaction's Documents tab (or the New transaction screen)
// is where files go in. This card picks one of those PDFs, newest first,
// and opens the review right here.
//
// Shown even when AI reading isn't configured, as a calm "not switched on"
// card, so the feature is discoverable rather than silently absent.
export function ContractAssistant({
  dealId,
  enabled,
  hasDeadlines,
  dealIsActive,
  documents,
  existingDeadlines,
  autoReadDocumentId,
}: {
  dealId: string;
  enabled: boolean;
  hasDeadlines: boolean;
  dealIsActive: boolean;
  documents: DocumentDTO[]; // newest first
  existingDeadlines: ExistingDeadline[];
  // Set when arriving from "New transaction → I have a signed contract":
  // the read starts by itself, once.
  autoReadDocumentId?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(analyzeContractAction, initialState);
  // Each read produces a new state object; remember which one was reviewed
  // so saving or discarding closes it without a reset.
  const [closedFor, setClosedFor] = useState<AnalysisState | null>(null);
  const [saved, setSaved] = useState<ApplyResult | null>(null);
  const autoStarted = useRef(false);
  // A transaction that already has its deadlines doesn't need a big card at
  // the top of every visit -- it starts as one line and opens on demand.
  // Stays open once opened (including through a save, when deadlines
  // appear), so the confirmation never collapses out from under the agent.
  const [expanded, setExpanded] = useState(!hasDeadlines || !!autoReadDocumentId);

  useEffect(() => {
    if (!enabled || !autoReadDocumentId || autoStarted.current) return;
    autoStarted.current = true;
    // Strip ?read= straight away: a refresh must never run (and pay for) the
    // same read twice. replaceState doesn't refetch the page.
    window.history.replaceState(null, "", window.location.pathname);
    const fd = new FormData();
    fd.set("dealId", dealId);
    fd.set("documentId", autoReadDocumentId);
    startTransition(() => formAction(fd));
  }, [enabled, autoReadDocumentId, dealId, formAction]);

  // "Read it for deadlines →" after an upload in Documents links here:
  // open the card (it may be collapsed) and bring it into view, then clear
  // the hash so clicking the link again still works.
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash !== "#contract-assistant") return;
      setExpanded(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      document.getElementById("contract-assistant")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const pdfs = documents.filter((d) => d.mimeType === "application/pdf");
  const reviewing = !!state.extracted && closedFor !== state;

  if (!expanded && !reviewing && !isPending) {
    return (
      <section
        id="contract-assistant"
        className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-border bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Sparkles size={16} className="shrink-0 text-accent" />
          Got an amended or countered contract?
        </p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm font-medium text-accent hover:opacity-80 sm:self-auto"
        >
          Read contract
        </button>
      </section>
    );
  }

  return (
    <section id="contract-assistant" className="scroll-mt-6 rounded-2xl border border-border bg-background p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Sparkles size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Contract assistant</h2>
          <p className="mt-1 text-sm text-muted">
            {hasDeadlines
              ? "Got an amended or countered contract? Read it and any changed dates update in place."
              : "Reads your purchase agreement, finds every deadline, shows you the line each one came from, and sets up your client's reminders."}{" "}
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
          dealIsActive={dealIsActive}
          existingDeadlines={existingDeadlines}
          extracted={state.extracted!}
          onDone={(result) => {
            setClosedFor(state);
            setSaved(result ?? null);
          }}
        />
      ) : isPending ? (
        <ReadingProgress />
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
        <div className="flex flex-col gap-4">
          {saved ? <SavedSummary result={saved} dealId={dealId} /> : null}

          <form action={formAction} onSubmit={() => setSaved(null)} className="flex max-w-md flex-col gap-4">
            <input type="hidden" name="dealId" value={dealId} />

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
              <Button type="submit" variant={saved ? "secondary" : "primary"}>
                {saved ? "Read another contract" : "Read contract"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
