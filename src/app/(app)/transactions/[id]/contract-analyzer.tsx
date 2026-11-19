"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, CircleHelp, Repeat2 } from "lucide-react";
import {
  checkDeadlines,
  describeFlag,
  matchExistingDeadlines,
  type DeadlineFlag,
  type ExistingDeadline,
} from "@/lib/contract-checks";
import { buildContractReview, computeReviewDates, type ReviewItem, type ReviewOption, type ReviewWarning } from "@/lib/contract-review";
import { describeRule } from "@/lib/deadline-rules";
import { todayInReminderZone } from "@/lib/deadline-reminder-schedule";
import {
  applyContractAnalysisAction,
  type AnalysisState,
  type ApplyResult,
  type ApplyState,
} from "@/app/actions/contract-analysis";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";

const initialApplyState: ApplyState = {};

type Row = ReviewItem & {
  checked: boolean;
  // Set when this matches a deadline already on the deal (an amended
  // contract): saving changes that deadline instead of adding a duplicate.
  existingId: string | null;
  oldDate: string | null;
};

type OptionRow = ReviewOption & { checked: boolean };

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

function ConfidenceChip({ confidence }: { confidence: "high" | "medium" | "low" }) {
  if (confidence === "high") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        confidence === "low" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
      }`}
    >
      <CircleHelp size={12} />
      {confidence === "low" ? "Unsure — check this" : "Fairly sure"}
    </span>
  );
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

// Terms the contract mentions that didn't become a deadline or option. The
// 0 Crooked Lake Road extension would have shown up right here.
function MissedList({ warnings }: { warnings: ReviewWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
        <AlertTriangle size={14} />
        Possibly missed — please check
      </p>
      <ul className="flex flex-col gap-2">
        {warnings.map((w, i) => (
          <li key={i} className="text-sm text-foreground">
            {w.text}
            {w.quote ? <span className="mt-0.5 block text-xs italic text-muted">&ldquo;{w.quote}&rdquo;</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewDeadlineRow({
  row,
  rows,
  flags,
  onChange,
}: {
  row: Row;
  rows: Row[];
  flags: DeadlineFlag[];
  onChange: (patch: Partial<Row>) => void;
}) {
  const weekend = flags.find((f): f is Extract<DeadlineFlag, { kind: "weekend" }> => f.kind === "weekend");
  const changed = !!row.existingId && row.oldDate !== row.dueDate;
  const unchanged = !!row.existingId && !changed;
  const needsLook = row.confidence !== "high" || row.dateMismatch || flags.length > 0 || !row.dueDate;
  const [open, setOpen] = useState(needsLook || changed);
  const ruleText = row.rule
    ? describeRule(
        { ...row.rule, baseDeadlineId: row.rule.baseIndex == null ? null : String(row.rule.baseIndex) },
        (id) => rows[Number(id)]?.label,
      )
    : null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3 transition-opacity ${
        row.confidence === "low" || !row.dueDate ? "border-danger/40 bg-danger/5" : row.confidence === "medium" || row.dateMismatch ? "border-warning/40 bg-warning/5" : "border-border"
      } ${row.checked ? "" : "opacity-50"}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="checkbox"
            checked={row.checked}
            onChange={(e) => onChange({ checked: e.target.checked })}
            aria-label={`Include ${row.label}`}
            className="h-5 w-5 shrink-0 accent-accent"
          />
          <input
            type="text"
            value={row.label}
            onChange={(e) => onChange({ label: e.target.value })}
            aria-label="Deadline name"
            className={`min-w-0 flex-1 ${inputClass}`}
          />
        </div>
        <input
          type="date"
          value={row.dueDate ?? ""}
          // Typing a date by hand makes it a fixed date: it no longer moves
          // with the acceptance date or an extension.
          onChange={(e) => onChange({ dueDate: e.target.value || null, rule: null, dateMismatch: false })}
          aria-label="Due date"
          className={`ml-7 sm:ml-0 ${inputClass}`}
        />
      </div>

      <div className="ml-7 flex flex-wrap items-center gap-2">
        {ruleText ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <Repeat2 size={12} />
            {ruleText}
          </span>
        ) : (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">Fixed date</span>
        )}
        {row.amount != null ? (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-foreground">{formatCurrency(row.amount)}</span>
        ) : null}
        <ConfidenceChip confidence={row.confidence} />
        {row.dateMismatch && row.readerDate && row.dueDate ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            Reader said {formatShortDate(row.readerDate)}; the rule gives {formatShortDate(row.dueDate)}
          </span>
        ) : null}
        {changed && row.dueDate ? (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            Changes {formatShortDate(row.oldDate!)} → {formatShortDate(row.dueDate)}
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
            onClick={() => onChange({ dueDate: weekend.suggestedDate, rule: null })}
            className="text-xs font-medium text-accent hover:opacity-80"
          >
            Move to {formatShortDate(weekend.suggestedDate)}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-8 items-center gap-0.5 text-xs font-medium text-muted hover:text-foreground"
        >
          Details
          <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div className="ml-7 flex flex-col gap-2">
          {row.ambiguity ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{row.ambiguity}</p>
          ) : null}
          {row.basis ? <p className="text-xs text-muted">{row.basis}</p> : null}
          {row.sourceQuote ? (
            <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted">
              &ldquo;{row.sourceQuote}&rdquo;
              {row.page ? <span className="not-italic"> — page {row.page}</span> : null}
            </blockquote>
          ) : (
            <p className="text-xs text-muted">No single passage was quoted for this one.</p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">What your client sees</span>
            <input
              type="text"
              value={row.clientNote}
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

function OptionCard({ option, rows, onChange }: { option: OptionRow; rows: Row[]; onChange: (patch: Partial<OptionRow>) => void }) {
  const unit = option.dayType === "BUSINESS" ? "business days" : "days";
  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 ${option.checked ? "" : "opacity-50"}`}>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={option.checked}
          onChange={(e) => onChange({ checked: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{option.label}</span>
          <span className="text-sm text-muted">
            {option.days} more {unit}
            {option.additionalDeposit != null ? ` · additional ${formatCurrency(option.additionalDeposit)} deposit` : ""}
            {option.cost != null ? ` · ${formatCurrency(option.cost)} fee` : ""}
            {option.exercisableBy ? ` · ${option.exercisableBy}'s choice` : ""}
          </span>
          {option.noticeText ? (
            <span className="text-xs text-muted">
              {option.noticeText}
              {option.noticeDate ? ` (by ${formatShortDate(option.noticeDate)})` : ""}
            </span>
          ) : null}
        </span>
      </label>
      <div className="ml-7 flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Moves these deadlines</span>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r, i) => {
            const on = option.targetIndexes.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    targetIndexes: on ? option.targetIndexes.filter((t) => t !== i) : [...option.targetIndexes, i],
                  })
                }
                className={`min-h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                  on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {option.sourceQuote ? (
          <blockquote className="mt-1 border-l-2 border-border pl-3 text-xs italic text-muted">
            &ldquo;{option.sourceQuote}&rdquo;
          </blockquote>
        ) : null}
      </div>
      <ConfidenceChip confidence={option.confidence} />
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
  const review = useMemo(() => buildContractReview(extracted), [extracted]);

  const [rows, setRows] = useState<Row[]>(() => {
    const matches = matchExistingDeadlines(
      review.items.map((d) => ({ label: d.label, dueDate: d.dueDate ?? "" })),
      existingDeadlines,
    );
    return review.items.map((d, i) => ({
      ...d,
      // A date already on file needs no action, so it starts unticked.
      checked: !(matches[i] && !matches[i]!.changed),
      existingId: matches[i]?.existingId ?? null,
      oldDate: matches[i]?.oldDate ?? null,
    }));
  });
  const [options, setOptions] = useState<OptionRow[]>(() => review.options.map((o) => ({ ...o, checked: true })));
  const [acceptanceDate, setAcceptanceDate] = useState(review.acceptanceDate ?? "");
  // Controlled so "After the closing date" updates as the agent edits it.
  const [closingDate, setClosingDate] = useState(review.closingDate ?? "");

  // Changing the acceptance (or closing) date re-works every rule date.
  function recompute(nextAcceptance: string, nextClosing: string) {
    setRows((prev) => {
      const dates = computeReviewDates(prev, nextAcceptance || null, nextClosing || null);
      return prev.map((r, i) => (r.rule ? { ...r, dueDate: dates[i] ?? r.dueDate, dateMismatch: false } : r));
    });
  }

  const flags = checkDeadlines({
    deadlines: rows.map((r) => ({ label: r.label, dueDate: r.dueDate ?? "" })),
    closingDate: closingDate || null,
    today: todayInReminderZone(new Date()).toISOString().slice(0, 10),
  });

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  useEffect(() => {
    // Close the panel once the save lands -- the parent re-renders from fresh
    // server data after revalidatePath. Must be an effect: onDone() sets state
    // in the parent, and doing that mid-render is a React error.
    if (state.result) onDone(state.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.result]);

  const selected = rows.filter((d) => d.checked);
  const missingDate = selected.filter((d) => !d.dueDate).length;
  const worthALook =
    flags.filter((f) => f.length > 0).length +
    extracted.concerns.length +
    rows.filter((r) => r.confidence !== "high" || r.dateMismatch).length;
  const savedOptions = options.filter((o) => o.checked);
  const saveLabel =
    selected.length === 0 ? "Save details" : `Save ${selected.length} deadline${selected.length === 1 ? "" : "s"}`;

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-xl border border-accent p-4 sm:p-5">
      <div>
        <p className="text-sm font-medium text-foreground">
          Found {rows.length} date{rows.length === 1 ? "" : "s"}
          {options.length > 0 ? ` and ${options.length} extension option${options.length === 1 ? "" : "s"}` : ""}
          {worthALook > 0 ? <span className="text-danger"> · {worthALook} worth a look</span> : null}
        </p>
        <p className="text-sm text-muted">Nothing is saved until you do. Edit anything, untick what you don&apos;t want.</p>
      </div>

      <input type="hidden" name="dealId" value={dealId} />

      <MissedList warnings={review.warnings} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Property address" name="propertyAddress" type="text" defaultValue={extracted.propertyAddress ?? ""} />
        <Field
          label="Sale price"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={extracted.salePrice !== null ? String(extracted.salePrice) : ""}
        />
        <Field
          label="Acceptance date"
          name="acceptanceDate"
          type="date"
          value={acceptanceDate}
          onChange={(e) => {
            setAcceptanceDate(e.target.value);
            recompute(e.target.value, closingDate);
          }}
          hint="Deadlines counted from acceptance update when you change this."
        />
        <Field
          label="Closing date"
          name="closingDate"
          type="date"
          value={closingDate}
          onChange={(e) => {
            setClosingDate(e.target.value);
            recompute(acceptanceDate, e.target.value);
          }}
        />
      </div>

      <ConcernList concerns={extracted.concerns} />

      <div className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No dated deadlines were found in this document.</p>
        ) : (
          rows.map((r, i) => (
            <ReviewDeadlineRow key={i} row={r} rows={rows} flags={flags[i]} onChange={(patch) => updateRow(i, patch)} />
          ))
        )}
      </div>

      {options.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Extension options</p>
          <p className="-mt-1 text-sm text-muted">Saved options show on the transaction as a one-tap button.</p>
          {options.map((o, i) => (
            <OptionCard
              key={i}
              option={o}
              rows={rows}
              onChange={(patch) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            />
          ))}
        </div>
      ) : null}

      <input
        type="hidden"
        name="deadlines"
        value={JSON.stringify(
          rows.map((r, index) => ({
            index,
            checked: r.checked,
            label: r.label,
            dueDate: r.dueDate,
            rule: r.rule,
            category: r.category,
            amount: r.amount,
            sourceQuote: r.sourceQuote,
            clientNote: r.clientNote,
            existingId: r.existingId,
          })),
        )}
      />
      <input
        type="hidden"
        name="options"
        value={JSON.stringify(
          savedOptions.map(({ label, days, dayType, additionalDeposit, cost, exercisableBy, noticeText, noticeDate, targetIndexes, sourceQuote }) => ({
            label,
            days,
            dayType,
            additionalDeposit,
            cost,
            exercisableBy,
            noticeText,
            noticeDate,
            targetIndexes,
            sourceQuote,
          })),
        )}
      />

      {dealIsActive ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="markUnderContract" defaultChecked className="h-5 w-5 accent-accent" />
          Mark this transaction as Under contract
        </label>
      ) : null}

      {missingDate > 0 ? (
        <p className="text-sm text-danger">
          {missingDate} ticked deadline{missingDate === 1 ? " has" : "s have"} no date. Add the acceptance date or a date
          before saving.
        </p>
      ) : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || missingDate > 0}>
          {isPending ? "Saving…" : saveLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDone()}>
          Discard
        </Button>
      </div>
    </form>
  );
}
