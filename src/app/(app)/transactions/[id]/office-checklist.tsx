"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, ClipboardCheck, ListPlus, Plus } from "lucide-react";
import {
  addOfficeTaskAction,
  addStandardChecklistAction,
  deleteOfficeTaskAction,
  toggleOfficeTaskAction,
  updateOfficeTaskAction,
} from "@/app/actions/office-tasks";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { isDeadlineOverdue } from "@/lib/deadline-reminder-schedule";

export type OfficeTaskDTO = {
  id: string;
  label: string;
  dueDate: string | null; // yyyy-mm-dd
  note: string | null;
  completedAt: string | null;
};

const initialState: FormState = {};

function shortDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AddTaskForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(addOfficeTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Task" name="label" placeholder="e.g. Order HOA documents" required error={state.fieldErrors?.label} />
        </div>
        <div className="sm:w-44">
          <Field label="Due (optional)" name="dueDate" type="date" />
        </div>
      </div>
      <Field label="Note (optional)" name="note" placeholder="e.g. ABC Title, file #12345" maxLength={500} />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Adding…" : "Add task"}
        </Button>
      </div>
    </form>
  );
}

function EditTaskRow({ task, dealId, onClose }: { task: OfficeTaskDTO; dealId: string; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(updateOfficeTaskAction, initialState);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-accent px-4 py-4">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="dealId" value={dealId} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field label="Task" name="label" defaultValue={task.label} required error={state.fieldErrors?.label} />
          </div>
          <div className="sm:w-44">
            <Field label="Due (optional)" name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
          </div>
        </div>
        <Field label="Note (optional)" name="note" defaultValue={task.note ?? ""} maxLength={500} />
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
        action={deleteOfficeTaskAction}
        onSubmit={(e) => {
          if (!confirm(`Delete "${task.label}"?`)) e.preventDefault();
        }}
        className="border-t border-border pt-3"
      >
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="dealId" value={dealId} />
        <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
          Delete this task
        </button>
      </form>
    </div>
  );
}

function TaskRow({
  task,
  dealId,
  canEdit,
  onEdit,
}: {
  task: OfficeTaskDTO;
  dealId: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const isDone = !!task.completedAt;
  const overdue = !isDone && !!task.dueDate && isDeadlineOverdue(task.dueDate);

  const check = (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
        isDone ? "border-success bg-success text-white" : "border-border"
      }`}
    >
      {isDone ? "✓" : ""}
    </span>
  );

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        {canEdit ? (
          <form action={toggleOfficeTaskAction} className="pt-0.5">
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="isDone" value={String(isDone)} />
            <button type="submit" aria-label={isDone ? "Mark not done" : "Mark done"}>
              {check}
            </button>
          </form>
        ) : (
          <span className="pt-0.5" aria-label={isDone ? "Done" : "Not done yet"}>
            {check}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-sm font-medium ${isDone ? "text-muted line-through" : "text-foreground"}`}>
            {task.label}
          </span>
          {task.dueDate || isDone ? (
            <span className={`text-sm ${overdue ? "text-danger" : "text-muted"}`}>
              {isDone
                ? `Done ${new Date(task.completedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : `Due ${shortDate(task.dueDate!)}${overdue ? " · Overdue" : ""}`}
            </span>
          ) : null}
          {task.note ? <span className="break-words text-xs text-muted">{task.note}</span> : null}
        </div>
      </div>
      {canEdit ? (
        <button type="button" onClick={onEdit} className="shrink-0 text-sm font-medium text-muted hover:text-foreground">
          Edit
        </button>
      ) : null}
    </div>
  );
}

// `canEdit`: the brokerage works the list; the agent sees it read-only so they
// know where the office stands on title, closing and signs.
export function OfficeChecklist({
  dealId,
  tasks,
  canEdit,
}: {
  dealId: string;
  tasks: OfficeTaskDTO[];
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const done = tasks.filter((t) => t.completedAt).length;

  return (
    <Card
      title="Office checklist"
      icon={ClipboardCheck}
      tone="accent"
      description={
        canEdit
          ? `What the office handles on this file${tasks.length > 0 ? ` · ${done} of ${tasks.length} done` : ""}. Your agent sees this, read-only.`
          : `Where your brokerage stands on this file · ${done} of ${tasks.length} done.`
      }
    >
      <div className="flex flex-col gap-4">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">Nothing on the office checklist yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) =>
              editingId === t.id ? (
                <EditTaskRow key={t.id} task={t} dealId={dealId} onClose={() => setEditingId(null)} />
              ) : (
                <TaskRow key={t.id} task={t} dealId={dealId} canEdit={canEdit} onEdit={() => setEditingId(t.id)} />
              ),
            )}
          </div>
        )}

        {canEdit ? (
          <div className="flex flex-col gap-2">
            <form action={addStandardChecklistAction}>
              <input type="hidden" name="dealId" value={dealId} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80"
              >
                <ListPlus size={16} />
                {tasks.length === 0 ? "Add the standard checklist" : "Add any missing standard tasks"}
              </button>
            </form>
            <details className="group rounded-xl border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <Plus size={16} className="text-muted" />
                  Add a task
                </span>
                <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border p-4">
                <AddTaskForm dealId={dealId} />
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
