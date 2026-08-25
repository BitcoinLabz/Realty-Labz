"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        icon={Users}
        title="No clients yet"
        description="Add the people you're working with. Their transactions, documents, and deadlines all live on their page."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={stageFilter}
        onChange={(e) => setStageFilter(e.target.value)}
        className={`w-fit ${selectClass}`}
      >
        <option value="">Everyone</option>
        {Object.entries(CLIENT_STAGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nobody at that stage right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                <span className="truncate text-sm text-muted">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info yet"}
                </span>
              </div>
              <span className="shrink-0">
                <Badge>{CLIENT_STAGE_LABELS[c.stage]}</Badge>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
