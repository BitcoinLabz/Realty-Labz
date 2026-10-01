"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import {
  checkDeadlines,
  describeFlag,
  matchExistingDeadlines,
  type DeadlineFlag,
  type ExistingDeadline,
} from "@/lib/contract-checks";
import { todayInReminderZone } from "@/lib/deadline-reminder-schedule";
import {
  applyContractAnalysisAction,
  type AnalysisState,
  type ApplyResult,
  type ApplyState,
} from "@/app/actions/contract-analysis";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialApplyState: ApplyState = {};

type ReviewDeadline = {
  label: string;
  dueDate: string;
  checked: boolean;
  sourceQuote: string | null;
  page: number | null;
  basis: string | null;
  clientNote: string;
  // Set when this matches a deadline already on the deal (an amended
  // contract): saving changes that deadline instead of adding a duplicate.
  existingId: string | null;
  oldDate: string | null;
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

// One deadline, compact by default: checkbox, name, date and any warnings.
// The supporting detail (the contract's own words, how a date was worked
// out, what the client sees) sits behind "Details", opened automatically
// only when there's something to look at.
function ReviewDeadlineRow({
  deadline,
  flags,
  onChange,
}: {
  deadline: ReviewDeadline;
  flags: DeadlineFlag[];
  onChange: (patch: Partial<ReviewDeadline>) => void;
}) {
  const weekend = flags.find((f): f is Extract<DeadlineFlag, { kind: "weekend" }> => f.kind === "weekend");
  const changed = !!deadline.existingId && deadline.oldDate !== deadline.dueDate;
  const unchanged = !!deadline.existingId && !changed;
  const [open, setOpen] = useState(flags.length > 0 || changed);

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-border p-3 transition-opacity ${
        deadline.checked ? "" : "opacity-50"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
        </div>
        <input
          type="date"
          value={deadline.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          aria-label="Due date"
          className={`ml-6 sm:ml-0 ${inputClass}`}
        />
      </div>

      <div className="ml-6 flex flex-wrap items-center gap-2">
        {changed ? (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            Changes {formatShortDate(deadline.oldDate!)} → {formatShortDate(deadline.dueDate)}
          </span>
        ) : null}
        {unchanged ? (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">Already on file</span>
        ) : null}
        {flags.map((f) => (
          <span key={f.kind} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-danger">
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-muted hover:text-foreground"
        >
          Details
          <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div className="ml-6 flex flex-col gap-2">
          {deadline.basis ? <p className="text-xs text-muted">{deadline.basis}</p> : null}
          {deadline.sourceQuote ? (
            <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted">
              &ldquo;{deadline.sourceQuote}&rdquo;
              {deadline.page ? <span className="not-italic"> — page {deadline.page}</span> : null}
            </blockquote>
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
      ) : null}
    </div>
  );
}

export function ReviewPanel({
  dealId,
  dealIsActive,
  existingDeadlines,
  extracted,
  onDone,
}: {
  dealId: string;
  dealIsActive: boolean;
  existingDeadlines: ExistingDeadline[];
  extracted: NonNullable<AnalysisState["extracted"]>;
  // Called with what the save did, or with nothing when the agent discards.
  onDone: (result?: ApplyResult) => void;
}) {
  const [state, formAction, isPending] = useActionState(applyContractAnalysisAction, initialApplyState);
  const [deadlines, setDeadlines] = useState<ReviewDeadline[]>(() => {
    const matches = matchExistingDeadlines(extracted.deadlines, existingDeadlines);
    return extracted.deadlines.map((d, i) => ({
      label: d.label,
      dueDate: d.dueDate,
      // A date already on file needs no action, so it starts unticked.
      checked: !(matches[i] && !matches[i]!.changed),
      sourceQuote: d.sourceQuote,
      page: d.page,
      basis: d.basis,
      clientNote: d.clientExplanation,
      existingId: matches[i]?.existingId ?? null,
      oldDate: matches[i]?.oldDate ?? null,
    }));
  });
  // Controlled so "After the closing date" updates as the agent edits it.
  const [closingDate, setClosingDate] = useState(extracted.closingDate ?? "");
  const flags = checkDeadlines({
    deadlines,
    closingDate: closingDate || null,
    today: todayInReminderZone(new Date()).toISOString().slice(0, 10),
  });

  function updateDeadline(index: number, patch: Partial<ReviewDeadline>) {
    setDeadlines((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  useEffect(() => {
    // Close the panel once the save lands -- the parent re-renders from fresh
    // server data after revalidatePath, so leaving the "proposed" view up
    // would show stale copies of values that are now actually saved. Must be
    // an effect, not a bare call during render: onDone() sets state in the
    // parent, and doing that mid-render is a React error.
    if (state.result) onDone(state.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.result]);

  const selected = deadlines.filter((d) => d.checked);
  const worthALook = flags.filter((f) => f.length > 0).length + extracted.concerns.length;
  const saveLabel =
    selected.length === 0
      ? "Save details"
      : `Save ${selected.length} deadline${selected.length === 1 ? "" : "s"}`;

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-xl border border-accent p-4 sm:p-5">
      <div>
        <p className="text-sm font-medium text-foreground">
          Found {deadlines.length} date{deadlines.length === 1 ? "" : "s"}
          {worthALook > 0 ? <span className="text-danger"> · {worthALook} worth a look</span> : null}
        </p>
        <p className="text-sm text-muted">Nothing is saved until you do. Edit anything, untick what you don&apos;t want.</p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <Field
          label="Closing date"
          name="closingDate"
          type="date"
          value={closingDate}
          onChange={(e) => setClosingDate(e.target.value)}
        />
      </div>

      <ConcernList concerns={extracted.concerns} />

      <div className="flex flex-col gap-2">
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted">No dated deadlines were found in this document.</p>
        ) : (
          deadlines.map((d, i) => (
            <ReviewDeadlineRow key={i} deadline={d} flags={flags[i]} onChange={(patch) => updateDeadline(i, patch)} />
          ))
        )}
      </div>

      <input
        type="hidden"
        name="deadlines"
        value={JSON.stringify(
          selected.map(({ label, dueDate, sourceQuote, clientNote, existingId }) => ({
            label,
            dueDate,
            sourceQuote,
            clientNote,
            existingId,
          })),
        )}
      />

      {dealIsActive ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="markUnderContract" defaultChecked className="h-4 w-4 accent-accent" />
          Mark this transaction as Under contract
        </label>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : saveLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDone()}>
          Discard
        </Button>
      </div>
    </form>
  );
}
