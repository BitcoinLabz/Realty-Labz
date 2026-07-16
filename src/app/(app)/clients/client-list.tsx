"use client";

import { useState } from "react";
import { deleteClientAction } from "@/app/actions/clients";
import { ClientForm } from "./client-form";
import type { ClientDTO } from "./types";

export function ClientList({ clients }: { clients: ClientDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No clients yet. Add your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clients.map((c) =>
        editingId === c.id ? (
          <div key={c.id} className="rounded-2xl border border-accent bg-background p-6">
            <ClientForm
              defaultValues={{
                id: c.id,
                name: c.name,
                email: c.email ?? "",
                phone: c.phone ?? "",
                notes: c.notes ?? "",
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div
            key={c.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{c.name}</span>
              <span className="text-sm text-muted">
                {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
              </span>
              {c.notes ? <p className="mt-1 text-sm text-muted">{c.notes}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setEditingId(c.id)}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Edit
              </button>
              <form
                action={deleteClientAction}
                onSubmit={(e) => {
                  if (!confirm(`Delete ${c.name}?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
