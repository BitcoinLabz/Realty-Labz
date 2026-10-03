"use client";

import { useActionState, useRef } from "react";
import { CheckCircle2, Circle, FileCheck2, Upload } from "lucide-react";
import {
  setDocumentRequirementAction,
  uploadDocumentAction,
  uploadOfficeDocumentAction,
} from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";

export type PaperworkItemDTO = {
  requirementId: string;
  label: string;
  document: { id: string; fileName: string } | null;
};

const initialState: FormState = {};

// One missing item: tapping Upload opens the file picker, and choosing a file
// uploads it straight away, counted against this item. No form to fill and
// no second button -- the whole interaction is "tap, pick".
function UploadForItem({
  dealId,
  clientId,
  requirementId,
  mode,
}: {
  dealId: string;
  clientId: string | null;
  requirementId: string;
  mode: "agent" | "office";
}) {
  const [state, formAction, isPending] = useActionState(
    mode === "office" ? uploadOfficeDocumentAction : uploadDocumentAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="requirementId" value={requirementId} />
      {mode === "agent" ? <input type="hidden" name="clientId" value={clientId ?? ""} /> : null}
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="sr-only"
        tabIndex={-1}
        onChange={() => {
          if (inputRef.current?.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80 disabled:opacity-50"
      >
        <Upload size={14} />
        {isPending ? "Uploading…" : "Upload"}
      </button>
      {state.error || state.fieldErrors?.file ? (
        <span className="text-right text-xs text-danger">{state.error ?? state.fieldErrors?.file}</span>
      ) : null}
    </form>
  );
}

// The office's paperwork list on one transaction. No approval step (founder
// decision): an item is done once something is on file for it.
export function PaperworkList({
  dealId,
  clientId,
  items,
  mode,
}: {
  dealId: string;
  clientId: string | null;
  items: PaperworkItemDTO[];
  mode: "agent" | "office";
}) {
  if (items.length === 0) return null;
  const onFile = items.filter((i) => i.document).length;
  const complete = onFile === items.length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <FileCheck2 size={17} className={complete ? "text-success" : "text-accent"} />
            Paperwork
          </h2>
          <p className="mt-1 text-sm text-muted">
            {complete
              ? "Everything your office needs is on file."
              : `${onFile} of ${items.length} on file. Upload right next to anything missing.`}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.requirementId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {item.document ? (
                <CheckCircle2 size={18} className="shrink-0 text-success" />
              ) : (
                <Circle size={18} className="shrink-0 text-border" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                {item.document ? (
                  <a
                    href={`/api/documents/${item.document.id}`}
                    className="truncate text-xs text-muted hover:text-accent"
                  >
                    {item.document.fileName}
                  </a>
                ) : null}
              </div>
            </div>
            {item.document ? null : (
              <UploadForItem dealId={dealId} clientId={clientId} requirementId={item.requirementId} mode={mode} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// "Counts as…" on a document that isn't matched to the list yet (or to
// change what it's matched to). Saves on change.
export function CountsAsSelect({
  documentId,
  dealId,
  current,
  options,
}: {
  documentId: string;
  dealId: string;
  current: string | null;
  options: { id: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  if (options.length === 0) return null;

  return (
    <form ref={formRef} action={setDocumentRequirementAction}>
      <input type="hidden" name="id" value={documentId} />
      <input type="hidden" name="dealId" value={dealId} />
      <select
        name="requirementId"
        defaultValue={current ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Which paperwork item this counts as"
        className="max-w-[12rem] rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted outline-none focus:border-accent"
      >
        <option value="">Counts as…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
