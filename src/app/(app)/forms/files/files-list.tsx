"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Mail } from "lucide-react";
import { DEAL_SIDE_LABELS, DEAL_STATUS_LABELS, type DealFileDTO } from "../../deals/types";

const selectClass =
  "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

export function FilesList({
  files,
  showAgentColumn,
}: {
  files: DealFileDTO[];
  showAgentColumn: boolean;
}) {
  const [search, setSearch] = useState("");
  const [side, setSide] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((f) => {
      if (query) {
        const haystack = `${f.propertyAddress} ${f.clientName ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (side && f.side !== side) return false;
      if (status && f.status !== status) return false;
      return true;
    });
  }, [files, search, side, status]);

  const hasActiveFilters = search.trim() !== "" || side !== "" || status !== "";

  function clearFilters() {
    setSearch("");
    setSide("");
    setStatus("");
  }

  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No properties yet. Add a deal from a client&apos;s page to see it here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by address or client…"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <select value={side} onChange={(e) => setSide(e.target.value)} className={selectClass}>
          <option value="">All representation</option>
          {Object.entries(DEAL_SIDE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          {Object.entries(DEAL_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {filtered.length} of {files.length} files
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
          No files match your search or filters.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/deals/${f.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background px-6 py-4 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {f.propertyAddress}
                </span>
                <span className="text-sm text-muted">
                  {f.clientName ?? "—"}
                  {showAgentColumn ? ` · ${f.agentName}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted">
                  {DEAL_SIDE_LABELS[f.side]}
                </span>
                <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted">
                  {DEAL_STATUS_LABELS[f.status]}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted">
                  <FileText size={14} />
                  {f.documentCount}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted">
                  <Mail size={14} />
                  {f.envelopeCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
