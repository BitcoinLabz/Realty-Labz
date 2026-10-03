"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadOfficeDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";

const initialState: FormState = {};

// The office files a document into an agent's transaction (see
// uploadOfficeDocumentAction). The agent sees it as "Added by your office".
export function OfficeUploadForm({ dealId }: { dealId: string }) {
  const [state, formAction, isPending] = useActionState(uploadOfficeDocumentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-md flex-col gap-4 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Add a document to this file</h3>
      <input type="hidden" name="dealId" value={dealId} />
      <FileDropInput
        id={`office-upload-${dealId}`}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        required
        helperText="The agent sees it on their transaction, marked as from your office."
        error={state.fieldErrors?.file}
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">Uploaded.</p> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}
