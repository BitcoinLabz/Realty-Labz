"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { checkDeadlines, describeFlag, type DeadlineFlag } from "@/lib/contract-checks";
import { todayInReminderZone } from "@/lib/deadline-reminder-schedule";
import {
  analyzeContractAction,
  applyContractAnalysisAction,
  type AnalysisState,
} from "@/app/actions/contract-analysis";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { DocumentDTO } from "@/app/(app)/clients/types";

const initialAnalysisState: AnalysisState = {};
const initialApplyState: FormState = {};

type ReviewDeadline = {
  label: string;
  dueDate: string;
  checked: boolean;
  sourceQuote: string | null;
  page: number | null;
  basis: string | null;
  clientNote: string;
};

const inputClass =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "Worth a second look": the model's judgement calls about the contract as a
// whole. Advisory only -- nothing here blocks saving.
function ConcernList({ concerns }: { concerns: NonNullable<AnalysisState["extracted"]>["concerns"] }) {
  if (concerns.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <AlertTriangle size={14} className="text-danger" />
        Worth a second look
      </p>
      <ul className="flex flex-col gap-2">
        {concerns.map((c, i) => (
          <li key={i} className="text-sm text-foreground">
            {c.issue}
            {c.sourceQuote ? (
              <span className="mt-0.5 block text-xs italic text-muted">&ldquo;{c.sourceQuote}&rdquo;</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewDeadlineCard({
  deadline,
  flags,
  onChange,
}: {
  deadline: ReviewDeadline;
  flags: DeadlineFlag[];
  onChange: (patch: Partial<ReviewDeadline>) => void;
}) {
  const weekend = flags.find((f): f is Extract<DeadlineFlag, { kind: "weekend" }> => f.kind === "weekend");

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-opacity ${
        deadline.checked ? "border-border" : "border-border opacity-50"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="checkbox"
          checked={deadline.checked}
          onChange={(e) => onChange({ checked: e.target.checked })}
          aria-label={`Include ${deadline.label}`}
          className="h-4 w-4 shrink-0 accent-accent"
        />
        <input
          type="text"
          value={deadline.label}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Deadline name"
          className={`min-w-0 flex-1 ${inputClass}`}
        />
        <input
          type="date"
          value={deadline.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          aria-label="Due date"
          className={inputClass}
        />
      </div>

      {deadline.basis ? <p className="text-xs text-muted">{deadline.basis}</p> : null}

      {deadline.sourceQuote ? (
        <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted">
          &ldquo;{deadline.sourceQuote}&rdquo;
          {deadline.page ? <span className="not-italic"> — page {deadline.page}</span> : null}
        </blockquote>
      ) : null}

      {flags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {flags.map((f) => (
            <span
              key={f.kind}
              className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-danger"
            >
              {describeFlag(f)}
            </span>
          ))}
          {weekend ? (
            <button
              type="button"
              onClick={() => onChange({ dueDate: weekend.suggestedDate })}
              className="text-xs font-medium text-accent hover:opacity-80"
            >
              Move to {formatShortDate(weekend.suggestedDate)}
            </button>
          ) : null}
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">What your client sees</span>
        <input
          type="text"
          value={deadline.clientNote}
          onChange={(e) => onChange({ clientNote: e.target.value })}
          maxLength={300}
          placeholder="Optional — a plain-English line for their portal and reminders"
          className={inputClass}
        />
      </label>
    </div>
  );
}

function ReviewPanel({
  dealId,
  extracted,
  onDone,
}: {
  dealId: string;
  extracted: NonNullable<AnalysisState["extracted"]>;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(applyContractAnalysisAction, initialApplyState);
  const [deadlines, setDeadlines] = useState<ReviewDeadline[]>(
    extracted.deadlines.map((d) => ({
      label: d.label,
      dueDate: d.dueDate,
      checked: true,
      sourceQuote: d.sourceQuote,
      page: d.page,
      basis: d.basis,
      clientNote: d.clientExplanation,
    })),
  );
  // The closing date field is uncontrolled elsewhere in this form; tracked
  // here only so "After the closing date" updates as the agent edits it.
  const [closingDate, setClosingDate] = useState(extracted.closingDate ?? "");
  const flags = checkDeadlines({
    deadlines,
    closingDate: closingDate || null,
    today: todayInReminderZone(new Date()).toISOString().slice(0, 10),
  });

  function updateDeadline(index: number, patch: Partial<ReviewDeadline>) {
    setDeadlines((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  const succeeded = !state.error && !state.fieldErrors && state !== initialApplyState;

  useEffect(() => {
    // Close the panel once the save lands -- the parent re-renders from fresh
    // server data after revalidatePath, so leaving the "proposed" view up
    // would show stale copies of values that are now actually saved. Must be
    // an effect, not a bare call during render: onDone() sets state in the
    // parent, and doing that mid-render is a React error.
    if (succeeded) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded]);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4 rounded-xl border border-accent p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Review what was found</p>
        <p className="text-sm text-muted">
          Nothing is saved until you apply it. Edit anything that looks wrong, and uncheck
          deadlines you don&apos;t want.
        </p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Property address"
          name="propertyAddress"
          type="text"
          defaultValue={extracted.propertyAddress ?? ""}
        />
        <Field
          label="Sale price"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={extracted.salePrice !== null ? String(extracted.salePrice) : ""}
        />
      </div>
      <Field
        label="Closing date"
        name="closingDate"
        type="date"
        value={closingDate}
        onChange={(e) => setClosingDate(e.target.value)}
      />

      <ConcernList concerns={extracted.concerns} />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">
          Deadlines found ({deadlines.length})
        </p>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted">No dated deadlines were found in this document.</p>
        ) : (
          deadlines.map((d, i) => (
            <ReviewDeadlineCard
              key={i}
              deadline={d}
              flags={flags[i]}
              onChange={(patch) => updateDeadline(i, patch)}
            />
          ))
        )}
      </div>

      <input
        type="hidden"
        name="deadlines"
        value={JSON.stringify(
          deadlines
            .filter((d) => d.checked)
            .map(({ label, dueDate, sourceQuote, clientNote }) => ({ label, dueDate, sourceQuote, clientNote })),
        )}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Applying…" : "Apply to this deal"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Discard
        </Button>
      </div>
    </form>
  );
}

export function ContractAnalyzer({
  dealId,
  documents,
}: {
  dealId: string;
  documents: DocumentDTO[];
}) {
  const [state, formAction, isPending] = useActionState(analyzeContractAction, initialAnalysisState);
  const [dismissed, setDismissed] = useState(false);

  const pdfs = documents.filter((d) => d.mimeType === "application/pdf");
  if (pdfs.length === 0) {
    return (
      <p className="text-sm text-muted">
        Upload a contract PDF below, then you can have it read for deadlines automatically.
      </p>
    );
  }

  const showReview = !!state.extracted && !dismissed;

  return (
    <div className="flex flex-col gap-3">
      {pdfs.map((doc) => (
        <form
          key={doc.id}
          action={formAction}
          onSubmit={() => setDismissed(false)}
          className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="truncate text-sm font-medium text-foreground">{doc.fileName}</span>
          <input type="hidden" name="documentId" value={doc.id} />
          <input type="hidden" name="dealId" value={dealId} />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {isPending ? "Reading…" : "Find deadlines"}
          </button>
        </form>
      ))}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      {showReview ? (
        <ReviewPanel
          dealId={dealId}
          extracted={state.extracted!}
          onDone={() => setDismissed(true)}
        />
      ) : null}
    </div>
  );
}
