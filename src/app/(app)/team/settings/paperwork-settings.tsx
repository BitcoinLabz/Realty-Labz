"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListPlus } from "lucide-react";
import {
  addRequiredDocumentAction,
  addStarterPaperworkAction,
  deleteRequiredDocumentAction,
  moveOfficeItemAction,
  updateRequiredDocumentAction,
} from "@/app/actions/office-settings";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DEAL_SIDE_SHORT } from "@/lib/vendor-kinds";

export type RequirementDTO = { id: string; label: string; sides: string[] };

const SIDES = ["BUYER", "SELLER", "DUAL", "TENANT", "LANDLORD"];
const initialState: FormState = {};

// Which transaction types an item applies to -- a row of toggle chips, since
// most items apply to two or three types at once.
function SideChips({ defaultSides }: { defaultSides: string[] }) {
  const [sides, setSides] = useState<string[]>(defaultSides);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-foreground">Needed on</legend>
      <div className="flex flex-wrap gap-2">
        {SIDES.map((side) => {
          const on = sides.includes(side);
          return (
            <label
              key={side}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
              }`}
            >
              <input
                type="checkbox"
                name="sides"
                value={side}
                checked={on}
                onChange={() => setSides((prev) => (on ? prev.filter((s) => s !== side) : [...prev, side]))}
                className="sr-only"
              />
              {DEAL_SIDE_SHORT[side]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AddRequirement() {
  const [state, formAction, isPending] = useActionState(addRequiredDocumentAction, initialState);
  const [formKey, setFormKey] = useState(0);
  const lastState = useRef(state);

  useEffect(() => {
    // Remount on success to clear the name and reset the chips.
    if (state !== lastState.current && state.success) setFormKey((k) => k + 1);
    lastState.current = state;
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3">
      <Field label="Document" name="label" placeholder="e.g. Wire fraud advisory" required error={state.fieldErrors?.label} />
      <SideChips defaultSides={["BUYER", "SELLER", "DUAL"]} />
      {state.fieldErrors?.sides ? <p className="text-sm text-danger">{state.fieldErrors.sides}</p> : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Adding…" : "Add to the list"}
        </Button>
      </div>
    </form>
  );
}

export function MoveButtons({
  id,
  list,
  isFirst,
  isLast,
}: {
  id: string;
  list: "paperwork" | "checklist";
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <>
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={moveOfficeItemAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="list" value={list} />
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            disabled={direction === "up" ? isFirst : isLast}
            aria-label={direction === "up" ? "Move up" : "Move down"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-30"
          >
            {direction === "up" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
          </button>
        </form>
      ))}
    </>
  );
}

function RequirementRow({ item, isFirst, isLast }: { item: RequirementDTO; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateRequiredDocumentAction, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-accent p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={item.id} />
          <Field label="Document" name="label" defaultValue={item.label} required error={state.fieldErrors?.label} />
          <SideChips defaultSides={item.sides} />
          {state.fieldErrors?.sides ? <p className="text-sm text-danger">{state.fieldErrors.sides}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
        <form
          action={deleteRequiredDocumentAction}
          onSubmit={(e) => {
            if (!confirm(`Remove "${item.label}" from the list? Documents already filed stay on their transactions.`))
              e.preventDefault();
          }}
          className="border-t border-border pt-3"
        >
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
            Remove from the list
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{item.label}</span>
        <span className="text-xs text-muted">{item.sides.map((s) => DEAL_SIDE_SHORT[s]).join(" · ")}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <MoveButtons id={item.id} list="paperwork" isFirst={isFirst} isLast={isLast} />
        <button type="button" onClick={() => setEditing(true)} className="ml-2 text-sm font-medium text-muted hover:text-foreground">
          Edit
        </button>
      </div>
    </div>
  );
}

export function PaperworkSettings({ items }: { items: RequirementDTO[] }) {
  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-5">
          <p className="text-sm text-foreground">
            No list yet. Start from a common Michigan set and trim it to fit your office.
          </p>
          <form action={addStarterPaperworkAction}>
            <button type="submit" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80">
              <ListPlus size={16} />
              Add the starter list
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <RequirementRow key={item.id} item={item} isFirst={i === 0} isLast={i === items.length - 1} />
          ))}
        </div>
      )}
      <div className="max-w-lg border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Add a document</h3>
        <AddRequirement />
      </div>
    </div>
  );
}
