"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CLIENT_STAGE_LABELS } from "@/lib/client-categories";
import type { ClientDTO } from "./types";

const selectClass =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export function ClientList({ clients }: { clients: ClientDTO[] }) {
  const [stageFilter, setStageFilter] = useState("");

  const filtered = useMemo(() => {
    if (!stageFilter) return clients;
    return clients.filter((c) => c.stage === stageFilter);
  }, [clients, stageFilter]);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No clients yet. Add your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={stageFilter}
        onChange={(e) => setStageFilter(e.target.value)}
        className={`w-fit ${selectClass}`}
      >
        <option value="">All stages</option>
        {Object.entries(CLIENT_STAGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
          No clients in this stage.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/forms/${c.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4 transition-colors hover:border-accent"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                <span className="text-sm text-muted">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted">
                {CLIENT_STAGE_LABELS[c.stage]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
