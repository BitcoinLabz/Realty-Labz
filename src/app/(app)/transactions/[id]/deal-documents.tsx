"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createFormTemplateFromDocumentAction } from "@/app/actions/form-templates";
import { deleteDocumentAction, updateDocumentLinksAction, uploadDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { formatFileSize } from "@/lib/format";
import { E_SIGNATURE_ENABLED } from "@/lib/features";
import { CountsAsSelect } from "./paperwork-list";
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

function DealDocumentRow({
  doc,
  dealId,
  requirementOptions,
}: {
  doc: DocumentDTO;
  dealId: string;
  requirementOptions: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createFormTemplateFromDocumentAction, initialState);
  const canSign = E_SIGNATURE_ENABLED && doc.mimeType === "application/pdf";
  const items: RowMenuItem[] = [];
  if (canSign) {
    items.push({
      label: isPending ? "Making signable…" : "Make signable",
      action: formAction,
      fields: { documentId: doc.id },
    });
  }
  if (!doc.addedByOffice) {
    items.push(
      {
        label: "Unlink from this transaction",
        action: updateDocumentLinksAction,
        fields: { id: doc.id, clientId: doc.clientId ?? "", dealId: "" },
      },
      {
        label: "Delete",
        destructive: true,
        confirm: `Delete ${doc.fileName}?`,
        action: deleteDocumentAction,
        fields: { id: doc.id },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href={`/api/documents/${doc.id}`} className="flex min-w-0 flex-col hover:text-accent">
          <span className="break-words text-sm font-medium text-foreground">{doc.fileName}</span>
          <span className="text-sm text-muted">
            {formatFileSize(doc.size)}
            {doc.addedByOffice ? " · Added by your office" : ""}
          </span>
        </a>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 sm:flex-none">
            <CountsAsSelect
              documentId={doc.id}
              dealId={dealId}
              current={doc.requirementId ?? null}
              options={requirementOptions}
            />
          </div>
          {items.length > 0 ? <RowMenu label={`Actions for ${doc.fileName}`} items={items} /> : null}
        </div>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </div>
  );
}

export function DealDocuments({
  dealId,
  clientId,
  documents,
  requirementOptions = [],
}: {
  dealId: string;
  clientId: string | null;
  documents: DocumentDTO[];
  // The office's paperwork list for this file, for the "Counts as…" picker.
  requirementOptions?: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {documents.length === 0 ? (
        <p className="text-sm text-muted">Nothing uploaded to this transaction yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <DealDocumentRow
              key={doc.id}
              doc={doc}
              dealId={dealId}
              requirementOptions={requirementOptions}
            />
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
