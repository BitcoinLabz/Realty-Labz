"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteTemplateAction, uploadTemplateAction } from "@/app/actions/document-templates";
import { createFormTemplateFromLibraryAction } from "@/app/actions/form-templates";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { RowMenu } from "@/components/ui/row-menu";
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
        label="File name"
        name="name"
        type="text"
        placeholder="e.g. Standard Purchase Agreement"
        required
        error={state.fieldErrors?.name}
      />
      <FileDropInput
        id="library-file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        required
        helperText="Upload your brokerage's real contracts and forms. PDFs can be turned into a fillable, sendable template below."
        error={state.fieldErrors?.file}
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Add to library"}
        </Button>
      </div>
    </form>
  );
}

function LibraryRow({ template, isTeamShared }: { template: DocumentTemplateDTO; isTeamShared: boolean }) {
  const [state, formAction, isPending] = useActionState(createFormTemplateFromLibraryAction, initialState);
  const isPdf = template.mimeType === "application/pdf";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href={`/api/document-templates/${template.id}`} className="flex min-w-0 flex-col hover:text-accent">
          <span className="truncate text-sm font-medium text-foreground">{template.name}</span>
          <span className="text-sm text-muted">
            {formatFileSize(template.size)}
            {isTeamShared ? ` · Added by ${template.creatorName}` : ""}
          </span>
        </a>
        <div className="flex shrink-0 items-center gap-3">
        {isPdf ? (
          <form action={formAction}>
            <input type="hidden" name="documentTemplateId" value={template.id} />
            <button type="submit" disabled={isPending} className="text-sm font-medium text-accent hover:opacity-80 disabled:opacity-60">
              {isPending ? "Creating…" : "Create fillable template"}
            </button>
          </form>
        ) : null}
        <RowMenu
          label={`Actions for ${template.name}`}
          items={[
            {
              label: "Delete",
              destructive: true,
              confirm: `Delete "${template.name}" from the library?`,
              action: deleteTemplateAction,
              fields: { id: template.id },
            },
          ]}
        />
        </div>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </div>
  );
}

export function LibraryList({
  templates,
  canManage,
  isTeamShared,
}: {
  templates: DocumentTemplateDTO[];
  canManage: boolean;
  isTeamShared: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="mb-1 text-base font-semibold text-foreground">
        {isTeamShared ? "Team library" : "Library"}
      </h2>
      <p className="mb-6 text-sm text-muted">
        {isTeamShared
          ? "Your brokerage's own contracts and forms, shared with the whole team. Turn a PDF into a fillable template to send it for signature."
          : "Your own contracts and forms. Turn a PDF into a fillable template to send it for signature."}
      </p>

      {canManage ? (
        <div className="mb-6 max-w-md border-b border-border pb-6">
          <UploadTemplateForm />
        </div>
      ) : null}

      {templates.length === 0 ? (
        <p className="text-sm text-muted">
          {canManage
            ? "No files in your library yet. Add your first one above."
            : "No files in the library yet. Ask a manager to add one."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) =>
            canManage ? (
              <LibraryRow key={t.id} template={t} isTeamShared={isTeamShared} />
            ) : (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <a href={`/api/document-templates/${t.id}`} className="flex min-w-0 flex-col hover:text-accent">
                  <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                  <span className="text-sm text-muted">
                    {formatFileSize(t.size)}
                    {isTeamShared ? ` · Added by ${t.creatorName}` : ""}
                  </span>
                </a>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
