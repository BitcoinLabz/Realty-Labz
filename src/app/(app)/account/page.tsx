import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, roleLabel } from "@/lib/authorization";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { InviteForm } from "./invite-form";
import { InviteList, type PendingInvite } from "./invite-list";

export default async function AccountPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { team: true },
  });

  if (!user) return null;

  const canManageTeam = user.team && isManager(user.role);

  const [teammates, invites] = canManageTeam
    ? await Promise.all([
        prisma.user.findMany({
          where: { teamId: user.teamId! },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, role: true },
        }),
        prisma.teamInvite.findMany({
          where: { teamId: user.teamId!, usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, null];

  const pendingInvites: PendingInvite[] =
    invites?.map((i) => ({
      id: i.id,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
    })) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile and security settings.</p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="text-base font-semibold text-foreground">Profile</h2>
        <div className="mt-6 max-w-sm">
          <ProfileForm name={user.name ?? ""} email={user.email} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="text-base font-semibold text-foreground">Password</h2>
        {user.passwordHash ? (
          <div className="mt-6 max-w-sm">
            <PasswordForm />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            You signed in with Google, so there&apos;s no password to manage here.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="text-base font-semibold text-foreground">Account type</h2>
        <p className="mt-2 text-sm text-muted">
          {user.team
            ? `You're on the ${user.team.name} team as ${roleLabel(user.role)}.`
            : "You have a solo account."}
        </p>
        {!user.team ? (
          <p className="mt-1 text-sm text-muted">
            Solo accounts can&apos;t currently convert to a team — sign up again and choose
            &quot;Start a team&quot; if you&apos;d like to invite teammates.
          </p>
        ) : null}
      </section>

      {canManageTeam ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="text-base font-semibold text-foreground">Team</h2>

          <div className="mt-6 flex flex-col gap-2">
            {teammates!.map((teammate) => (
              <div
                key={teammate.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{teammate.name}</span>
                  <span className="text-sm text-muted">{teammate.email}</span>
                </div>
                <span className="text-sm text-muted">{roleLabel(teammate.role)}</span>
              </div>
            ))}
          </div>

          <h3 className="mb-3 mt-8 text-sm font-semibold text-foreground">Invite a teammate</h3>
          <InviteForm />

          <h3 className="mb-3 mt-8 text-sm font-semibold text-foreground">Pending invites</h3>
          <InviteList invites={pendingInvites} />
        </section>
      ) : null}
    </div>
  );
}
