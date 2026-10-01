"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { createFormTemplateFromDocumentAction } from "@/app/actions/form-templates";
import { deleteDocumentAction, updateDocumentLinksAction, uploadDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { formatFileSize } from "@/lib/format";
import { E_SIGNATURE_ENABLED } from "@/lib/features";
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
  // Whether the file just sent was a PDF -- only then is "read it for
  // deadlines" a sensible next step.
  const [lastWasPdf, setLastWasPdf] = useState(false);

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
        setLastWasPdf(input?.files?.[0]?.type === "application/pdf");
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="clientId" value={clientId ?? ""} />
      <FileDropInput
        id="deal-doc-file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        required
        helperText="PDF, Word, or image files up to 15MB."
        error={state.fieldErrors?.file}
      />

      {clientId ? (
        <>
          <input type="hidden" name="visibilityChoice" value="1" />
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input type="checkbox" name="visibleToClient" defaultChecked className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              Show in your client&apos;s portal
              <span className="block text-muted">Turn off for internal files they shouldn&apos;t see.</span>
            </span>
          </label>
        </>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {succeeded && lastWasPdf ? (
        <p className="text-sm text-foreground">
          Uploaded.{" "}
          <a href="#contract-assistant" className="font-medium text-accent hover:opacity-80">
            Read it for deadlines →
          </a>
        </p>
      ) : null}

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
                {E_SIGNATURE_ENABLED && doc.mimeType === "application/pdf" ? (
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
