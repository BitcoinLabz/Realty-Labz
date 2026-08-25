"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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

type ReviewDeadline = { label: string; dueDate: string; checked: boolean };

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
    extracted.deadlines.map((d) => ({ ...d, checked: true })),
  );

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
        defaultValue={extracted.closingDate ?? ""}
      />

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">
          Deadlines found ({deadlines.length})
        </p>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted">No dated deadlines were found in this document.</p>
        ) : (
          deadlines.map((d, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="checkbox"
                checked={d.checked}
                onChange={(e) => updateDeadline(i, { checked: e.target.checked })}
                aria-label={`Include ${d.label}`}
                className="mt-1 sm:mt-0"
              />
              <input
                type="text"
                value={d.label}
                onChange={(e) => updateDeadline(i, { label: e.target.value })}
                aria-label="Deadline name"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <input
                type="date"
                value={d.dueDate}
                onChange={(e) => updateDeadline(i, { dueDate: e.target.value })}
                aria-label="Due date"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ))
        )}
      </div>

      <input
        type="hidden"
        name="deadlines"
        value={JSON.stringify(
          deadlines.filter((d) => d.checked).map(({ label, dueDate }) => ({ label, dueDate })),
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
