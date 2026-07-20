"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteTemplateAction, uploadTemplateAction } from "@/app/actions/document-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatFileSize } from "@/lib/format";
import type { DocumentTemplateDTO } from "./types";

const initialState: FormState = {};

function UploadTemplateForm() {
  const [state, formAction, isPending] = useActionState(uploadTemplateAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field
        label="Template name"
        name="name"
        type="text"
        placeholder="e.g. Standard Purchase Agreement"
        required
        error={state.fieldErrors?.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="template-file" className="text-sm font-medium text-foreground">
          File
        </label>
        <input
          id="template-file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          required
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
        />
        {state.fieldErrors?.file ? (
          <p className="text-sm text-danger">{state.fieldErrors.file}</p>
        ) : null}
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Add template"}
        </Button>
      </div>
    </form>
  );
}

export function DocumentTemplates({
  templates,
  canManage,
  isTeamShared,
}: {
  templates: DocumentTemplateDTO[];
  canManage: boolean;
  isTeamShared: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <h2 className="mb-1 text-base font-semibold text-foreground">
        {isTeamShared ? "Team templates" : "Templates"}
      </h2>
      <p className="mb-6 text-sm text-muted">
        {isTeamShared
          ? "Standard forms shared with your whole team — separate from a specific client or deal."
          : "Standard forms you reuse across clients and deals."}
      </p>

      {canManage ? (
        <div className="mb-6 max-w-md border-b border-border pb-6">
          <UploadTemplateForm />
        </div>
      ) : null}

      {templates.length === 0 ? (
        <p className="text-sm text-muted">
          {canManage
            ? "No templates yet. Add your first one above."
            : "No templates yet. Ask a manager to add one."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
            >
              <a
                href={`/api/document-templates/${t.id}`}
                className="flex flex-col hover:text-accent"
              >
                <span className="text-sm font-medium text-foreground">{t.name}</span>
                <span className="text-sm text-muted">
                  {formatFileSize(t.size)}
                  {isTeamShared ? ` · Added by ${t.creatorName}` : ""}
                </span>
              </a>
              {canManage ? (
                <form
                  action={deleteTemplateAction}
                  onSubmit={(e) => {
                    if (!confirm(`Delete the "${t.name}" template?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
