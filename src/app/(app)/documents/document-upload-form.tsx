"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocumentAction } from "@/app/actions/documents";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ClientOption } from "./types";

const initialState: FormState = {};

export function DocumentUploadForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
    }
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium text-foreground">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          required
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
        />
        <p className="text-sm text-muted">PDF, Word, or image files up to 15MB.</p>
        {state.fieldErrors?.file ? (
          <p className="text-sm text-danger">{state.fieldErrors.file}</p>
        ) : null}
      </div>

      {clients.length > 0 ? (
        <Select label="Client (optional)" name="clientId" defaultValue="">
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
