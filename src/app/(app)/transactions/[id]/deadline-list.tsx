"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, Plus, Send, X } from "lucide-react";
import {
  createDeadlineAction,
  deleteDeadlineAction,
  toggleDeadlineAction,
  updateDeadlineAction,
} from "@/app/actions/deal-deadlines";
import { sendDeadlineReminderNowAction } from "@/app/actions/deadline-reminders";
import { applyDeadlineTemplateAction } from "@/app/actions/deadline-templates";
import {
  buildDeadlinesFromTemplate,
  formatDeadlineDate,
  isWeekendUtc,
} from "@/lib/deadline-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { DealDeadlineDTO } from "../types";
import type {
  DeadlineTemplateDTO,
  DeadlineTemplateItemDTO,
} from "../deadline-sets/types";

const initialState: FormState = {};

// Sends the reminder immediately, to the agent and their client together.
// Separate from the automatic 3-days-out pass: this can be fired as many
// times as a client needs chasing, and doesn't touch emailReminderSentAt.
// Its own useActionState instance per row keeps pending/result state from
// leaking between deadlines.
function SendReminderButton({ deadlineId, dealId }: { deadlineId: string; dealId: string }) {
  const [state, formAction, isPending] = useActionState(
    sendDeadlineReminderNowAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={deadlineId} />
      <input type="hidden" name="dealId" value={dealId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
      >
        <Send size={14} />
        {isPending ? "Sending…" : "Send reminder"}
      </button>
      {state.success ? (
        <span className="text-right text-xs text-accent">{state.success}</span>
      ) : null}
      {state.error ? <span className="text-right text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

function AddDeadlineForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(createDeadlineAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex-1">
        <Field
          label="Contingency or deadline"
          name="label"
          type="text"
          placeholder="e.g. Inspection contingency"
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

// Applies a saved deadline set, dating every item off one anchor date.
// Previews the exact dates before committing, so a mistyped anchor is caught
// here rather than after four wrong rows are written.
// Applies a saved deadline set, dating every item off one anchor date.
//
// The rows are editable here before applying: a saved set holds the day counts
// you use most, but a given contract can differ (land runs on different
// timelines than a resale), and an agent shouldn't have to keep a second set
// for every variation or fix the dates by hand afterwards. Edits are scoped to
// this transaction -- the saved set is never modified.
function ApplyDeadlineSet({
  dealId,
  templates,
}: {
  dealId: string;
  templates: DeadlineTemplateDTO[];
}) {
  const [state, formAction, isPending] = useActionState(applyDeadlineTemplateAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [anchorDate, setAnchorDate] = useState("");
  const [rows, setRows] = useState<DeadlineTemplateItemDTO[]>(templates[0]?.items ?? []);

  // Swapping sets reloads its rows, discarding any tweaks to the previous one.
  function selectTemplate(id: string) {
    setTemplateId(id);
    setRows(templates.find((t) => t.id === id)?.items ?? []);
  }

  function updateRow(index: number, patch: Partial<DeadlineTemplateItemDTO>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // Same pure helper the server uses, so the preview can't disagree with what
  // actually gets written.
  const preview = buildDeadlinesFromTemplate(rows, anchorDate);
  const selected = templates.find((t) => t.id === templateId);
  const isTweaked =
    !!selected &&
    (rows.length !== selected.items.length ||
      rows.some(
        (r, i) => r.offsetDays !== selected.items[i]?.offsetDays || r.label !== selected.items[i]?.label,
      ));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="dealId" value={dealId} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Which set?"
            name="templateId"
            value={templateId}
            onChange={(e) => selectTemplate(e.target.value)}
            error={state.fieldErrors?.templateId}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-52">
          <Field
            label="Counting from"
            name="anchorDate"
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            required
            error={state.fieldErrors?.anchorDate}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending} className="shrink-0">
          {isPending ? "Adding…" : "Add these"}
        </Button>
      </div>

      <p className="-mt-1 text-sm text-muted">
        Usually the day the offer was accepted. Adjust any of the day counts below if this contract
        runs differently — your saved set won&apos;t change.
      </p>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {rows.map((row, i) => {
            const due = preview[i]?.dueDate;
            return (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  aria-label={`Deadline ${i + 1} name`}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={row.offsetDays}
                    onChange={(e) => updateRow(i, { offsetDays: Number(e.target.value) })}
                    aria-label={`Deadline ${i + 1} days from start`}
                    className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <span className="whitespace-nowrap text-xs text-muted">days</span>
                  <span className="min-w-32 whitespace-nowrap text-xs text-muted">
                    {due
                      ? new Date(formatDeadlineDate(due) + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                    {/* Contracts usually roll a weekend deadline to the next
                        business day. Flagged, not auto-shifted -- some
                        contracts genuinely do count calendar days. */}
                    {due && isWeekendUtc(due) ? (
                      <span className="text-danger"> · weekend</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${row.label || `deadline ${i + 1}`}`}
                    className="text-muted hover:text-danger"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {isTweaked ? (
            <p className="text-xs text-muted">
              Adjusted for this transaction only — &quot;{selected!.name}&quot; stays as you saved
              it.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Rows submit as one blob, the same hidden-JSON pattern used by the
          set editor and the contract analyzer. Blank labels are dropped so an
          emptied row doesn't fail the whole submit. */}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          rows
            .filter((r) => r.label.trim())
            .map((r) => ({ label: r.label.trim(), offsetDays: r.offsetDays })),
        )}
      />

      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

// A tucked-away section, closed until asked for. Native <details> so it's
// keyboard- and screen-reader-friendly with no state to manage.
function Disclosure({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

// One deadline opened for editing, in place. Delete lives here rather than
// on every row: it's the rare action, and keeping it one tap further away
// both declutters the list and makes an accidental delete harder.
function EditDeadlineRow({
  deadline,
  dealId,
  onClose,
}: {
  deadline: DealDeadlineDTO;
  dealId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateDeadlineAction, initialState);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-accent px-4 py-4">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={deadline.id} />
        <input type="hidden" name="dealId" value={dealId} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field
              label="Name"
              name="label"
              type="text"
              defaultValue={deadline.label}
              required
              error={state.fieldErrors?.label}
            />
          </div>
          <div className="sm:w-44">
            <Field
              label="Due date"
              name="dueDate"
              type="date"
              defaultValue={deadline.dueDate}
              required
              error={state.fieldErrors?.dueDate}
            />
          </div>
        </div>
        <Field
          label="What your client sees (optional)"
          name="clientNote"
          type="text"
          maxLength={300}
          defaultValue={deadline.clientNote ?? ""}
          hint="A plain-English line shown in their portal and reminder emails."
        />
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
      <form
        action={deleteDeadlineAction}
        onSubmit={(e) => {
          if (!confirm(`Delete "${deadline.label}"?`)) e.preventDefault();
        }}
        className="border-t border-border pt-3"
      >
        <input type="hidden" name="id" value={deadline.id} />
        <input type="hidden" name="dealId" value={dealId} />
        <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
          Delete this deadline
        </button>
      </form>
    </div>
  );
}

function DeadlineRow({
  deadline: d,
  dealId,
  onEdit,
}: {
  deadline: DealDeadlineDTO;
  dealId: string;
  onEdit: () => void;
}) {
  const isDone = !!d.completedAt;
  const isOverdue = !isDone && new Date(d.dueDate + "T00:00:00") < new Date();

  return (
    // Stacks on phones so the name never gets squeezed into a sliver by the
    // actions beside it.
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <form action={toggleDeadlineAction} className="pt-0.5">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="isCompleted" value={String(isDone)} />
          <button
            type="submit"
            aria-label={isDone ? "Mark incomplete" : "Mark complete"}
            className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs transition-colors ${
              isDone ? "border-accent bg-accent text-accent-foreground" : "border-border"
            }`}
          >
            {isDone ? "✓" : ""}
          </button>
        </form>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-sm font-medium ${isDone ? "text-muted line-through" : "text-foreground"}`}>
            {d.label}
          </span>
          <span className={`text-sm ${isOverdue ? "text-danger" : "text-muted"}`}>
            {new Date(d.dueDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {isOverdue ? " · Overdue" : ""}
            {d.reminderSentAt
              ? ` · Reminder sent ${new Date(d.reminderSentAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
          </span>
          {d.clientNote && !isDone ? <span className="text-xs text-muted">Client sees: {d.clientNote}</span> : null}
          {d.sourceQuote ? (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none">From the contract</summary>
              <p className="mt-1 border-l-2 border-border pl-3 italic">&ldquo;{d.sourceQuote}&rdquo;</p>
            </details>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-start justify-end gap-4 pl-8 sm:pl-0">
        {!isDone ? <SendReminderButton deadlineId={d.id} dealId={dealId} /> : null}
        <button type="button" onClick={onEdit} className="text-sm font-medium text-muted hover:text-foreground">
          Edit
        </button>
      </div>
    </div>
  );
}

// The list comes first -- it's what an agent opens this tab for. Adding by
// hand and applying a saved set are tucked into closed sections below it,
// so a transaction with its deadlines in place isn't a wall of empty forms.
export function DeadlineList({
  dealId,
  deadlines,
  deadlineTemplates,
}: {
  dealId: string;
  deadlines: DealDeadlineDTO[];
  deadlineTemplates: DeadlineTemplateDTO[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {deadlines.length === 0 ? (
        <p className="text-sm text-muted">No deadlines yet. Read the contract above, or add them below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {deadlines.map((d) =>
            editingId === d.id ? (
              <EditDeadlineRow key={d.id} deadline={d} dealId={dealId} onClose={() => setEditingId(null)} />
            ) : (
              <DeadlineRow key={d.id} deadline={d} dealId={dealId} onEdit={() => setEditingId(d.id)} />
            ),
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Disclosure icon={<Plus size={16} className="text-muted" />} label="Add a deadline">
          <AddDeadlineForm dealId={dealId} />
        </Disclosure>
        {deadlineTemplates.length > 0 ? (
          <Disclosure icon={<CalendarClock size={16} className="text-muted" />} label="Add a saved set of deadlines">
            <ApplyDeadlineSet dealId={dealId} templates={deadlineTemplates} />
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}
