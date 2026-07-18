"use client";

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
  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No documents yet. Upload your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
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
  );
}
