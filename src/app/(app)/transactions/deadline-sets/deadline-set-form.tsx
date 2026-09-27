"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  createDeadlineTemplateAction,
  updateDeadlineTemplateAction,
} from "@/app/actions/deadline-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { DeadlineTemplateDTO, DeadlineTemplateItemDTO } from "./types";

const initialState: FormState = {};

// The set most buyer files need, offered as a starting point so a new user
// isn't staring at an empty row list wondering what belongs here. Matches the
// example already used in the deadline empty state.
const STARTER_ITEMS: DeadlineTemplateItemDTO[] = [
  { label: "Inspection contingency", offsetDays: 10 },
  { label: "Appraisal", offsetDays: 14 },
  { label: "Financing contingency", offsetDays: 21 },
  { label: "Closing", offsetDays: 45 },
];

export function DeadlineSetForm({
  template,
  onDone,
}: {
  template?: DeadlineTemplateDTO;
  onDone?: () => void;
}) {
  const isEdit = !!template;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateDeadlineTemplateAction : createDeadlineTemplateAction,
    initialState,
  );
  const [items, setItems] = useState<DeadlineTemplateItemDTO[]>(
    template?.items ?? STARTER_ITEMS,
  );

  function updateItem(index: number, patch: Partial<DeadlineTemplateItemDTO>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEdit ? <input type="hidden" name="id" value={template!.id} /> : null}

      <div className="max-w-md">
        <Field
          label="Name this set"
          name="name"
          type="text"
          placeholder="e.g. Buyer purchase"
          defaultValue={template?.name}
          required
          error={state.fieldErrors?.name}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Deadlines in this set</span>
        <p className="-mt-1 text-sm text-muted">
          Days counted from the date you pick when you apply it — usually the day the offer was
          accepted. Use a negative number for something due before that date.
        </p>

        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              placeholder="e.g. Inspection contingency"
              aria-label={`Deadline ${i + 1} name`}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={item.offsetDays}
                onChange={(e) => updateItem(i, { offsetDays: Number(e.target.value) })}
                aria-label={`Deadline ${i + 1} days from start`}
                className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <span className="whitespace-nowrap text-sm text-muted">days</span>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove deadline ${i + 1}`}
                className="text-muted hover:text-danger"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { label: "", offsetDays: 0 }])}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80"
        >
          <Plus size={15} />
          Add another deadline
        </button>
      </div>

      {/* Rows live in local state and submit as one blob -- same hidden-JSON
          pattern the form-field designer uses. Blank labels are dropped here
          so an empty trailing row doesn't fail the whole save. */}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items
            .filter((it) => it.label.trim())
            .map((it) => ({ label: it.label.trim(), offsetDays: it.offsetDays })),
        )}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Save this set"}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
