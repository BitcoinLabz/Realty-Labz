"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteDocumentAction, updateDocumentLinksAction, uploadDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { formatFileSize } from "@/lib/format";
import type { ClientOption, DocumentDTO } from "./types";

const initialState: FormState = {};

function UnfiledUploadForm() {
  const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:max-w-md"
    >
      <FileDropInput
        id="unfiled-file"
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

export function UnfiledDocuments({
  documents,
  clients,
}: {
  documents: DocumentDTO[];
  clients: ClientOption[];
}) {
  return (
    <div>
      <UnfiledUploadForm />

      {documents.length === 0 ? (
        <p className="text-sm text-muted">Nothing unfiled.</p>
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
              <div className="flex shrink-0 items-center gap-3">
                <form action={updateDocumentLinksAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="dealId" value={doc.dealId ?? ""} />
                  <select
                    name="clientId"
                    defaultValue=""
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="" disabled>
                      Assign to client…
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
    </div>
  );
}
