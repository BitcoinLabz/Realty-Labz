"use client";

import Link from "next/link";
import { deleteFormTemplateAction } from "@/app/actions/form-templates";
import { RowMenu } from "@/components/ui/row-menu";
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
          className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
        >
          <Link href={`/forms/templates/${t.id}`} className="flex min-w-0 flex-col">
            <span className="break-words text-sm font-medium text-foreground">{t.name}</span>
            <span className="text-sm text-muted">
              {formatFileSize(t.size)} · {t.fieldCount} field{t.fieldCount === 1 ? "" : "s"} ·{" "}
              {t.signerCount} signer{t.signerCount === 1 ? "" : "s"}
              {isTeamShared ? ` · Added by ${t.creatorName}` : ""}
            </span>
          </Link>
          {canManage ? (
            <RowMenu
              label={`Actions for ${t.name}`}
              items={[
                {
                  label: "Delete",
                  destructive: true,
                  confirm: `Delete the "${t.name}" template?`,
                  action: deleteFormTemplateAction,
                  fields: { id: t.id },
                },
              ]}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
