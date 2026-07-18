import Link from "next/link";
import type { ClientDTO } from "./types";

export function ClientList({ clients }: { clients: ClientDTO[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No clients yet. Add your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clients.map((c) => (
        <Link
          key={c.id}
          href={`/clients/${c.id}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4 transition-colors hover:border-accent"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{c.name}</span>
            <span className="text-sm text-muted">
              {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
