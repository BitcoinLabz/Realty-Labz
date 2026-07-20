"use client";

import { useMemo, useState } from "react";
import { deleteDocumentAction, updateDocumentLinksAction } from "@/app/actions/documents";
import { formatFileSize } from "@/lib/format";
import type { ClientOption, DealOption, DocumentDTO } from "./types";

export function DocumentList({
  documents,
  clients,
  deals,
}: {
  documents: DocumentDTO[];
  clients: ClientOption[];
  deals: DealOption[];
}) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dealFilter, setDealFilter] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (query && !doc.fileName.toLowerCase().includes(query)) return false;
      if (clientFilter && doc.clientId !== clientFilter) return false;
      if (dealFilter && doc.dealId !== dealFilter) return false;
      return true;
    });
  }, [documents, search, clientFilter, dealFilter]);

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No documents yet. Upload your first one above.
      </div>
    );
  }

  const hasActiveFilters = search.trim() !== "" || clientFilter !== "" || dealFilter !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by file name…"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={dealFilter}
          onChange={(e) => setDealFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          <option value="">All deals</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.propertyAddress}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
          {hasActiveFilters
            ? "No documents match your search or filters."
            : "No documents yet. Upload your first one above."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4"
            >
              <div className="flex flex-col">
                <a
                  href={`/api/documents/${doc.id}`}
                  className="text-sm font-medium text-foreground hover:text-accent"
                >
                  {doc.fileName}
                </a>
                <span className="text-sm text-muted">
                  {formatFileSize(doc.size)}
                  {" · "}
                  {new Date(doc.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <form
                  action={updateDocumentLinksAction}
                  className="flex items-center gap-2"
                  key={`${doc.clientId ?? "none"}-${doc.dealId ?? "none"}`}
                >
                  <input type="hidden" name="id" value={doc.id} />
                  <select
                    name="clientId"
                    defaultValue={doc.clientId ?? ""}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="dealId"
                    defaultValue={doc.dealId ?? ""}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">No deal</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.propertyAddress}
                      </option>
                    ))}
                  </select>
                </form>
                <form
                  action={deleteDocumentAction}
                  onSubmit={(e) => {
                    if (!confirm(`Delete ${doc.fileName}?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={doc.id} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
