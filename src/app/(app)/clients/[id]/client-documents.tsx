"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteDocumentAction, updateDocumentLinksAction, uploadDocumentAction } from "@/app/actions/documents";
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
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
            >
              <a href={`/api/documents/${doc.id}`} className="flex flex-col hover:text-accent">
                <span className="text-sm font-medium text-foreground">{doc.fileName}</span>
                <span className="text-sm text-muted">{formatFileSize(doc.size)}</span>
              </a>
              <div className="flex shrink-0 items-center gap-4">
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
