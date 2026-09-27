"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  deleteDocumentAction,
  setDocumentVisibilityAction,
  updateDocumentLinksAction,
  uploadDocumentAction,
} from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { Select } from "@/components/ui/select";
import { formatFileSize } from "@/lib/format";
import type { DealOption, DocumentDTO } from "../types";

const initialState: FormState = {};

function ClientUploadForm({ clientId, deals }: { clientId: string; deals: DealOption[] }) {
  const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <FileDropInput
        id="client-doc-file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        required
        helperText="PDF, Word, or image files up to 15MB."
        error={state.fieldErrors?.file}
      />

      <input type="hidden" name="visibilityChoice" value="1" />
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input type="checkbox" name="visibleToClient" defaultChecked className="mt-0.5 h-4 w-4 accent-accent" />
        <span>
          Show in their portal
          <span className="block text-muted">Turn off for internal files they shouldn&apos;t see.</span>
        </span>
      </label>

      {deals.length > 0 ? (
        <Select label="Deal (optional)" name="dealId" defaultValue="">
          <option value="">No deal</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.propertyAddress}
            </option>
          ))}
        </Select>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}

// A switch rather than a button, so the current state is readable at a
// glance: on means the client can see and download it in their portal.
function PortalVisibilityToggle({ id, visible }: { id: string; visible: boolean }) {
  return (
    <form action={setDocumentVisibilityAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visible" value={visible ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={visible}
        aria-label={visible ? "Visible in client portal. Hide it" : "Hidden from client portal. Show it"}
        className="flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground"
      >
        <span className="whitespace-nowrap">{visible ? "Client can see" : "Hidden"}</span>
        <span
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            visible ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              visible ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </form>
  );
}

export function ClientDocuments({
  clientId,
  documents,
  deals,
}: {
  clientId: string;
  documents: DocumentDTO[];
  deals: DealOption[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {documents.length === 0 ? (
        <p className="text-sm text-muted">No documents for this client yet — upload one below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <a href={`/api/documents/${doc.id}`} className="flex min-w-0 flex-col hover:text-accent">
                  <span className="break-words text-sm font-medium text-foreground">{doc.fileName}</span>
                  <span className="text-sm text-muted">{formatFileSize(doc.size)}</span>
                </a>
                <PortalVisibilityToggle id={doc.id} visible={doc.visibleToClient ?? true} />
              </div>
              <div className="flex items-center gap-4 border-t border-border pt-3">
                <form action={updateDocumentLinksAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="clientId" value="" />
                  <input type="hidden" name="dealId" value={doc.dealId ?? ""} />
                  <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                    Unlink from this client
                  </button>
                </form>
                <form
                  action={deleteDocumentAction}
                  onSubmit={(e) => {
                    if (!confirm(`Delete ${doc.fileName}?`)) e.preventDefault();
                  }}
                  className="ml-auto"
                >
                  <input type="hidden" name="id" value={doc.id} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md border-t border-border pt-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Upload a document</h3>
        <ClientUploadForm clientId={clientId} deals={deals} />
      </div>
    </div>
  );
}
