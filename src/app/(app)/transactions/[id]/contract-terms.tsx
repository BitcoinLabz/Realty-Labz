"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, History, Plus } from "lucide-react";
import {
  applyManualExtensionAction,
  exerciseExtensionOptionAction,
  setAcceptanceDateAction,
  undoExtensionAction,
  deleteExtensionOptionAction,
} from "@/app/actions/deal-extensions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { RowMenu } from "@/components/ui/row-menu";
import { formatCurrency } from "@/lib/format";
import { planExtension, type DayType, type RuleDeadline } from "@/lib/deadline-rules";

// Extensions & amendments on a transaction (2026-11-19): the acceptance date
// every rule deadline counts from, one-tap buttons for the extension options
// the contract allows, a manual extension/amendment form, and the history
// with undo. Every change previews exactly which dates move before saving.

export type RuleDeadlineDTO = {
  id: string;
  label: string;
  dueDate: string;
  completed: boolean;
  rule: { baseEvent: "ACCEPTANCE" | "CLOSING" | "DEADLINE"; baseDeadlineId: string | null; offsetDays: number; dayType: DayType } | null;
  extensionDays: number;
  isClosing: boolean;
};

export type ExtensionOptionDTO = {
  id: string;
  label: string;
  days: number;
  dayType: DayType;
  additionalDeposit: number | null;
  cost: number | null;
  exercisableBy: string | null;
  noticeText: string | null;
  noticeDate: string | null;
  targetDeadlineIds: string[];
  sourceQuote: string | null;
  usedBy: string | null; // id of the live extension that used it
};

export type ExtensionDTO = {
  id: string;
  label: string;
  days: number;
  dayType: DayType;
  additionalDeposit: number | null;
  note: string | null;
  appliedByName: string;
  appliedAt: string;
  undoneAt: string | null;
  undoneByName: string | null;
  movedCount: number;
};

const initial: FormState = {};
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const fmt = (s: string | Date) =>
  (typeof s === "string" ? d(s) : s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function toRule(list: RuleDeadlineDTO[]): RuleDeadline[] {
  return list.map((x) => ({
    id: x.id,
    label: x.label,
    rule: x.rule,
    dueDate: d(x.dueDate),
    extensionDays: x.extensionDays,
    isClosing: x.isClosing,
    completed: x.completed,
  }));
}

/** "Due diligence: Nov 30 → Jan 29" for every date an extension would move. */
function Preview({
  deadlines,
  acceptanceDate,
  closingDate,
  targetIds,
  days,
  dayType,
}: {
  deadlines: RuleDeadlineDTO[];
  acceptanceDate: string | null;
  closingDate: string | null;
  targetIds: string[];
  days: number;
  dayType: DayType;
}) {
  const changes = useMemo(() => {
    if (!days || targetIds.length === 0) return [];
    const plan = planExtension({
      deadlines: toRule(deadlines),
      dates: { acceptanceDate: acceptanceDate ? d(acceptanceDate) : null, closingDate: closingDate ? d(closingDate) : null },
      targetIds,
      days,
      dayType,
    });
    return deadlines
      .filter((x) => plan.newDates.get(x.id) && plan.newDates.get(x.id)!.toISOString().slice(0, 10) !== x.dueDate)
      .map((x) => ({ label: x.label, from: x.dueDate, to: plan.newDates.get(x.id)! }));
  }, [deadlines, acceptanceDate, closingDate, targetIds, days, dayType]);

  if (changes.length === 0) return <p className="text-sm text-muted">No open deadlines would move.</p>;
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3 text-sm">
      {changes.map((c) => (
        <li key={c.label} className="flex flex-wrap justify-between gap-x-3">
          <span className="text-foreground">{c.label}</span>
          <span className="tabular-nums text-muted">
            {fmt(c.from)} → <span className="font-medium text-foreground">{fmt(c.to)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AcceptanceDateForm({ dealId, acceptanceDate, ruleCount }: { dealId: string; acceptanceDate: string | null; ruleCount: number }) {
  const [state, action, pending] = useActionState(setAcceptanceDateAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="sm:w-56">
        <Field
          label="Acceptance date"
          name="acceptanceDate"
          type="date"
          defaultValue={acceptanceDate ?? ""}
          error={state.fieldErrors?.acceptanceDate}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Updating…" : "Update dates"}
      </Button>
      <p className="text-sm text-muted sm:pb-2.5">
        {ruleCount > 0
          ? `${ruleCount} deadline${ruleCount === 1 ? " is" : "s are"} counted from contract dates and will update.`
          : "When the contract became binding."}
      </p>
    </form>
  );
}

function OptionButton({
  dealId,
  option,
  deadlines,
  acceptanceDate,
  closingDate,
}: {
  dealId: string;
  option: ExtensionOptionDTO;
  deadlines: RuleDeadlineDTO[];
  acceptanceDate: string | null;
  closingDate: string | null;
}) {
  const [state, action, pending] = useActionState(exerciseExtensionOptionAction, initial);
  const [confirming, setConfirming] = useState(false);
  const unit = option.dayType === "BUSINESS" ? "business-day" : "day";
  const requires = [
    option.additionalDeposit != null ? `additional ${formatCurrency(option.additionalDeposit)} deposit` : null,
    option.cost != null ? `${formatCurrency(option.cost)} fee` : null,
  ].filter(Boolean);
  const targetsMissing = option.targetDeadlineIds.filter((id) => deadlines.some((x) => x.id === id)).length === 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{option.label}</p>
          <p className="text-sm text-muted">
            {option.exercisableBy ? `${option.exercisableBy}'s option` : "Optional"}
            {option.noticeText ? ` · ${option.noticeText}` : ""}
            {option.noticeDate ? ` (by ${fmt(option.noticeDate)})` : ""}
          </p>
        </div>
        <RowMenu
          label={`Actions for ${option.label}`}
          items={[
            {
              label: "Remove this option",
              destructive: true,
              confirm: "Remove this extension option? It won't change any dates.",
              action: deleteExtensionOptionAction,
              fields: { dealId, optionId: option.id },
            },
          ]}
        />
      </div>

      {targetsMissing ? (
        <p className="flex items-start gap-1.5 text-sm text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          This option isn&apos;t linked to any deadline on this transaction, so using it wouldn&apos;t move anything. Use
          a manual extension instead.
        </p>
      ) : option.usedBy ? (
        <p className="text-sm font-medium text-success">Used — see the history below to undo it.</p>
      ) : confirming ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="optionId" value={option.id} />
          <p className="text-sm text-foreground">These dates will change:</p>
          <Preview
            deadlines={deadlines}
            acceptanceDate={acceptanceDate}
            closingDate={closingDate}
            targetIds={option.targetDeadlineIds}
            days={option.days}
            dayType={option.dayType}
          />
          {option.additionalDeposit != null ? (
            <p className="text-sm text-muted">
              A {formatCurrency(option.additionalDeposit)} deposit deadline will be added
              {option.noticeDate ? `, due ${fmt(option.noticeDate)}` : ", due today"}.
            </p>
          ) : null}
          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Applying…" : "Apply extension"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" onClick={() => setConfirming(true)} className="min-h-11 self-start text-left">
          <CalendarPlus size={16} className="mr-1.5 shrink-0" />
          Exercise {option.days}-{unit} extension
          {requires.length ? ` — requires ${requires.join(" and ")}` : ""}
        </Button>
      )}
    </div>
  );
}

function ManualExtensionForm({
  dealId,
  deadlines,
  acceptanceDate,
  closingDate,
}: {
  dealId: string;
  deadlines: RuleDeadlineDTO[];
  acceptanceDate: string | null;
  closingDate: string | null;
}) {
  const [state, action, pending] = useActionState(applyManualExtensionAction, initial);
  const open = deadlines.filter((x) => !x.completed);
  const [targets, setTargets] = useState<string[]>([]);
  const [days, setDays] = useState("");
  const [dayType, setDayType] = useState<DayType>("CALENDAR");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="dealId" value={dealId} />
      <Field label="What is it?" name="label" placeholder="e.g. Amendment #1 — inspection extension" maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Days"
          name="days"
          type="number"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          error={state.fieldErrors?.days}
          hint="Use a negative number to shorten."
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Counted as</span>
          <select
            name="dayType"
            value={dayType}
            onChange={(e) => setDayType(e.target.value as DayType)}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="CALENDAR">Calendar days</option>
            <option value="BUSINESS">Business days</option>
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Which deadlines does it move?</legend>
        <div className="flex flex-wrap gap-1.5">
          {open.map((x) => {
            const on = targets.includes(x.id);
            return (
              <label
                key={x.id}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                  on ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground hover:bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  name="targetIds"
                  value={x.id}
                  checked={on}
                  onChange={() => setTargets((t) => (on ? t.filter((id) => id !== x.id) : [...t, x.id]))}
                  className="sr-only"
                />
                {x.label}
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.targetIds ? <p className="text-sm text-danger">{state.fieldErrors.targetIds}</p> : null}
        <p className="text-xs text-muted">Deadlines counted from the ones you pick move with them automatically.</p>
      </fieldset>
      {Number(days) && targets.length ? (
        <Preview
          deadlines={deadlines}
          acceptanceDate={acceptanceDate}
          closingDate={closingDate}
          targetIds={targets}
          days={Number(days)}
          dayType={dayType}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Extra deposit (optional)"
          name="additionalDeposit"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          error={state.fieldErrors?.additionalDeposit}
        />
        <Field label="Deposit due" name="depositDueDate" type="date" error={state.fieldErrors?.depositDueDate} />
      </div>
      <Field label="Note (optional)" name="note" maxLength={500} placeholder="e.g. Signed by both parties Oct 3" />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Applying…" : "Apply"}
        </Button>
      </div>
    </form>
  );
}

export function ContractTerms({
  dealId,
  acceptanceDate,
  closingDate,
  deadlines,
  options,
  extensions,
}: {
  dealId: string;
  acceptanceDate: string | null;
  closingDate: string | null;
  deadlines: RuleDeadlineDTO[];
  options: ExtensionOptionDTO[];
  extensions: ExtensionDTO[];
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const ruleCount = deadlines.filter((x) => x.rule).length;

  return (
    <div className="flex flex-col gap-5">
      <AcceptanceDateForm dealId={dealId} acceptanceDate={acceptanceDate} ruleCount={ruleCount} />

      {options.length > 0 ? (
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <OptionButton
              key={o.id}
              dealId={dealId}
              option={o}
              deadlines={deadlines}
              acceptanceDate={acceptanceDate}
              closingDate={closingDate}
            />
          ))}
        </div>
      ) : null}

      {deadlines.some((x) => !x.completed) ? (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
            className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
          >
            <Plus size={16} className="text-muted" />
            Add an extension or amendment
          </button>
          {manualOpen ? (
            <div className="border-t border-border p-4">
              <ManualExtensionForm dealId={dealId} deadlines={deadlines} acceptanceDate={acceptanceDate} closingDate={closingDate} />
            </div>
          ) : null}
        </div>
      ) : null}

      {extensions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <History size={15} className="text-muted" />
            History
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {extensions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${x.undoneAt ? "text-muted line-through" : "text-foreground"}`}>
                    {x.label}
                  </p>
                  <p className="text-xs text-muted">
                    {x.days > 0 ? "+" : ""}
                    {x.days} {x.dayType === "BUSINESS" ? "business days" : "days"}
                    {x.additionalDeposit != null ? ` · ${formatCurrency(x.additionalDeposit)} deposit` : ""} · {x.appliedByName},{" "}
                    {fmt(new Date(x.appliedAt))}
                    {x.undoneAt ? ` · undone by ${x.undoneByName ?? "someone"}, ${fmt(new Date(x.undoneAt))}` : ""}
                  </p>
                  {x.note ? <p className="text-xs text-muted">{x.note}</p> : null}
                </div>
                {x.undoneAt ? null : (
                  <RowMenu
                    label={`Actions for ${x.label}`}
                    items={[
                      {
                        label: "Undo",
                        destructive: true,
                        confirm: `Undo this? ${x.movedCount} deadline${x.movedCount === 1 ? "" : "s"} go back${
                          x.additionalDeposit != null ? " and the deposit deadline is removed" : ""
                        }.`,
                        action: undoExtensionAction,
                        fields: { dealId, extensionId: x.id },
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
