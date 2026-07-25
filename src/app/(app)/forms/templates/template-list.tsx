"use client";

import Link from "next/link";
import { deleteFormTemplateAction } from "@/app/actions/form-templates";
import { formatFileSize } from "@/lib/format";
import type { FormTemplateDTO } from "./types";

export function TemplateList({
  templates,
  canManage,
  isTeamShared,
}: {
  templates: FormTemplateDTO[];
  canManage: boolean;
  isTeamShared: boolean;
}) {
  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted">
        {canManage ? "No form templates yet. Add your first one above." : "No form templates yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
        >
          <Link href={`/forms/templates/${t.id}`} className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{t.name}</span>
            <span className="text-sm text-muted">
              {formatFileSize(t.size)} · {t.fieldCount} field{t.fieldCount === 1 ? "" : "s"} ·{" "}
              {t.signerCount} signer{t.signerCount === 1 ? "" : "s"}
              {isTeamShared ? ` · Added by ${t.creatorName}` : ""}
            </span>
          </Link>
          {canManage ? (
            <form
              action={deleteFormTemplateAction}
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
  );
}
