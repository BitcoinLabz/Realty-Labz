"use client";

import { useState } from "react";
import { revokeInviteAction } from "@/app/actions/team-invites";
import { roleLabel } from "@/lib/authorization";
import type { Role } from "@/generated/prisma/enums";

export type PendingInvite = {
  id: string;
  role: Role;
  expiresAt: string; // ISO
};

export function InviteList({ invites }: { invites: PendingInvite[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (invites.length === 0) {
    return <p className="text-sm text-muted">No pending invites.</p>;
  }

  async function copyLink(id: string) {
    const link = `${window.location.origin}/join/${id}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {roleLabel(invite.role)} invite
            </span>
            <span className="text-sm text-muted">
              Expires{" "}
              {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={() => copyLink(invite.id)}
              className="text-sm font-medium text-accent hover:opacity-80"
            >
              {copiedId === invite.id ? "Copied!" : "Copy link"}
            </button>
            <form action={revokeInviteAction}>
              <input type="hidden" name="id" value={invite.id} />
              <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                Revoke
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
