import { KeyRound, User, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager, roleLabel } from "@/lib/authorization";
import { Card } from "@/components/ui/card";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { PageHeader } from "@/components/ui/page-header";
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

  const tabs = [
    {
      id: "profile",
      label: "Your details",
      content: (
        <>
          <Card title="Your name & email" icon={User}>
            <div className="max-w-sm">
              <ProfileForm name={user.name ?? ""} email={user.email} />
            </div>
          </Card>

          <Card title="Account type">
            <p className="text-sm text-muted">
              {user.team
                ? `You're on the ${user.team.name} team as ${roleLabel(user.role)}.`
                : "You have a solo account — everything here is just yours."}
            </p>
            {!user.team ? (
              <p className="mt-2 text-sm text-muted">
                Want to bring teammates on and share transactions with them? Get in touch from the{" "}
                <a href="/support" className="font-medium text-accent hover:opacity-80">
                  support page
                </a>{" "}
                and we&apos;ll switch your account over.
              </p>
            ) : null}
          </Card>
        </>
      ),
    },
    {
      id: "security",
      label: "Sign-in & security",
      content: (
        <Card title="Password" icon={KeyRound}>
          {user.passwordHash ? (
            <div className="max-w-sm">
              <PasswordForm />
            </div>
          ) : (
            <p className="text-sm text-muted">
              You sign in with Google, so there&apos;s no password to manage here.
            </p>
          )}
        </Card>
      ),
    },
  ];

  if (canManageTeam) {
    tabs.push({
      id: "team",
      label: "Your team",
      content: (
        <>
          <Card title="Teammates" icon={Users}>
            <div className="flex flex-col gap-2">
              {teammates!.map((teammate) => (
                <div
                  key={teammate.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {teammate.name}
                    </span>
                    <span className="truncate text-sm text-muted">{teammate.email}</span>
                  </div>
                  <span className="shrink-0 text-sm text-muted">{roleLabel(teammate.role)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Invite a teammate"
            description="Generate a private sign-up link, then send it to them however you like."
          >
            <div className="max-w-md">
              <InviteForm />
            </div>
          </Card>

          <Card title="Invites waiting to be used">
            <InviteList invites={pendingInvites} />
          </Card>
        </>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Account" description="Your details, sign-in, and team settings." />
      <DetailTabs tabs={tabs} />
    </div>
  );
}
