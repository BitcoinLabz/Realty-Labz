"use client";

import { useActionState, useEffect, useRef } from "react";
import { PenLine } from "lucide-react";
import { createFormTemplateFromDocumentAction } from "@/app/actions/form-templates";
import { deleteDocumentAction, updateDocumentLinksAction, uploadDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { formatFileSize } from "@/lib/format";
import type { DocumentDTO } from "@/app/(app)/clients/types";

const initialState: FormState = {};

// Mirrors forms/[id]/client-documents.tsx's ClientUploadForm, locked to
// dealId instead of clientId. When the deal has a linked client, the upload
// also carries that clientId so the document shows up on both the deal's
// and the client's page — matching how a document can already carry both
// links when uploaded from the client side.
function DealUploadForm({ dealId, clientId }: { dealId: string; clientId: string | null }) {
  const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="clientId" value={clientId ?? ""} />
      <FileDropInput
        id="deal-doc-file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        required
        helperText="PDF, Word, or image files up to 15MB."
        error={state.fieldErrors?.file}
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}

export function DealDocuments({
  dealId,
  clientId,
  documents,
}: {
  dealId: string;
  clientId: string | null;
  documents: DocumentDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {documents.length === 0 ? (
        <p className="text-sm text-muted">Nothing uploaded to this transaction yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <a href={`/api/documents/${doc.id}`} className="flex min-w-0 flex-col hover:text-accent">
                <span className="truncate text-sm font-medium text-foreground">{doc.fileName}</span>
                <span className="text-sm text-muted">{formatFileSize(doc.size)}</span>
              </a>
              <div className="flex shrink-0 flex-wrap items-center gap-4">
                {/* Only a PDF can go through the field designer. Shown per
                    document rather than as one section action, since which
                    file you want signable is the whole question. */}
                {doc.mimeType === "application/pdf" ? (
                  <form action={createFormTemplateFromDocumentAction}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80"
                    >
                      <PenLine size={14} />
                      Make signable
                    </button>
                  </form>
                ) : null}
                <form action={updateDocumentLinksAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="clientId" value={doc.clientId ?? ""} />
                  <input type="hidden" name="dealId" value="" />
                  <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                    Unlink from this transaction
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
        <DealUploadForm dealId={dealId} clientId={clientId} />
      </div>
    </div>
  );
}
