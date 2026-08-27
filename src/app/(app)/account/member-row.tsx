"use client";

import { useActionState } from "react";
import { changeMemberRoleAction, removeMemberAction } from "@/app/actions/team-members";
import type { FormState } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/enums";

const initialState: FormState = {};

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "AGENT", label: "Agent", hint: "Sees only their own work." },
  { value: "TEAM_LEAD", label: "Team lead", hint: "Sees everyone's transactions." },
  { value: "ADMIN", label: "Admin", hint: "Sees everything and can manage the roster." },
];

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

export function MemberRow({
  member,
  isYou,
  canManage,
  orgWord,
}: {
  member: TeamMember;
  isYou: boolean;
  canManage: boolean;
  orgWord: string;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRoleAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    initialState,
  );

  // A broker's own row shows no controls at all -- self-demotion and
  // self-removal are the two easiest ways to lock a team out by accident,
  // and the server refuses them either way.
  const showControls = canManage && !isYou && member.role !== "BROKER";
  const error = roleState.error ?? removeState.error;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {member.name ?? member.email}
            {isYou ? <span className="ml-2 text-sm font-normal text-muted">You</span> : null}
          </span>
          <span className="truncate text-sm text-muted">{member.email}</span>
        </div>

        {showControls ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <form action={roleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={member.id} />
              <select
                name="role"
                defaultValue={member.role}
                disabled={rolePending}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Remove ${member.name ?? member.email} from your ${orgWord}?\n\nThey keep their account and all of their own data — your ${orgWord} just stops being able to see it.`,
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="userId" value={member.id} />
              <button
                type="submit"
                disabled={removePending}
                className="text-sm font-medium text-danger hover:opacity-80 disabled:opacity-50"
              >
                {removePending ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
        ) : (
          <span className="shrink-0 text-sm text-muted">{roleWord(member.role)}</span>
        )}
      </div>

      {roleState.success ? <p className="text-sm text-accent">{roleState.success}</p> : null}
      {removeState.success ? <p className="text-sm text-accent">{removeState.success}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function roleWord(role: Role) {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? "Broker";
}
