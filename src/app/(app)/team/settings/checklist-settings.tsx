"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ListPlus } from "lucide-react";
import {
  addChecklistItemAction,
  addStarterChecklistAction,
  deleteChecklistItemAction,
} from "@/app/actions/office-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MoveButtons } from "./paperwork-settings";

export type ChecklistItemDTO = { id: string; label: string };

const initialState: FormState = {};

function AddItem() {
  const [state, formAction, isPending] = useActionState(addChecklistItemAction, initialState);
  const [formKey, setFormKey] = useState(0);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current && state.success) setFormKey((k) => k + 1);
    lastState.current = state;
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Task" name="label" placeholder="e.g. Order HOA documents" required error={state.fieldErrors?.label} />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending} className="shrink-0">
        {isPending ? "Adding…" : "Add"}
      </Button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

// The template copied onto every file the moment it goes Under contract.
// Editing it only changes files from then on -- checklists already on files
// stay as they are, since the office may already be working them.
export function ChecklistSettings({ items, usingStandard }: { items: ChecklistItemDTO[]; usingStandard: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-5">
          <p className="text-sm text-foreground">
            Until you set your own, files get the standard list: {usingStandard.join(", ")}.
          </p>
          <form action={addStarterChecklistAction}>
            <button type="submit" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80">
              <ListPlus size={16} />
              Start from the standard list
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <span className="min-w-0 text-sm font-medium text-foreground">{item.label}</span>
              <div className="flex shrink-0 items-center gap-1">
                <MoveButtons id={item.id} list="checklist" isFirst={i === 0} isLast={i === items.length - 1} />
                <form
                  action={deleteChecklistItemAction}
                  onSubmit={(e) => {
                    if (!confirm(`Remove "${item.label}"? Files that already have it keep it.`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="ml-2 text-sm font-medium text-danger hover:opacity-80">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="max-w-lg border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Add a task</h3>
        <AddItem />
      </div>
    </div>
  );
}
