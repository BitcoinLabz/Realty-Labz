"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { deleteDeadlineTemplateAction } from "@/app/actions/deadline-templates";
import { EmptyState } from "@/components/ui/empty-state";
import { DeadlineSetForm } from "./deadline-set-form";
import type { DeadlineTemplateDTO } from "./types";

function describeOffset(offsetDays: number): string {
  if (offsetDays === 0) return "same day";
  const magnitude = Math.abs(offsetDays);
  const unit = magnitude === 1 ? "day" : "days";
  return offsetDays > 0 ? `+${offsetDays} ${unit}` : `${magnitude} ${unit} before`;
}

export function DeadlineSetList({
  templates,
  canManage,
  isTeamShared,
}: {
  templates: DeadlineTemplateDTO[];
  canManage: boolean;
  isTeamShared: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {templates.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No deadline sets yet"
          description={
            canManage
              ? "Most transactions repeat the same contingencies — inspection, financing, appraisal, closing. Set them up once here and adding them to a transaction becomes a single click."
              : "Nobody on your team has set one up yet. Ask a manager to add one."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="rounded-xl border border-accent p-4">
                <DeadlineSetForm template={t} onDone={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={t.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-sm text-muted">
                      {t.items.length} deadline{t.items.length === 1 ? "" : "s"}
                      {isTeamShared ? ` · Added by ${t.creatorName}` : ""}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setEditingId(t.id)}
                        className="text-sm font-medium text-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <form
                        action={deleteDeadlineTemplateAction}
                        onSubmit={(e) => {
                          if (!confirm(`Delete the "${t.name}" set?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-danger hover:opacity-80"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {t.items.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted"
                    >
                      {item.label} · {describeOffset(item.offsetDays)}
                    </span>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {canManage ? (
        <div className="border-t border-border pt-6">
          {isAdding ? (
            <DeadlineSetForm onDone={() => setIsAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              New deadline set
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
