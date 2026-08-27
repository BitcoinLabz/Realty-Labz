import { KeyRound, User, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership, roleLabel, teamLabel } from "@/lib/authorization";
import { Card } from "@/components/ui/card";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { InviteForm } from "./invite-form";
import { InviteList, type PendingInvite } from "./invite-list";
import { MemberRow } from "./member-row";

export default async function AccountPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { team: true },
  });

  if (!user) return null;

  // Any teammate sees the roster; only some can change it.
  const onATeam = !!user.team;

  const [teammates, invites] = onATeam
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

  const members = teammates ?? [];
  const orgWord = teamLabel(members);
  const canManage = canManageMembership(
    { id: user.id, role: user.role, teamId: user.teamId },
    members,
  );

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
                ? `You're part of ${user.team.name} as ${roleLabel(user.role)}.`
                : "You have a solo account — everything here is just yours."}
            </p>
            {!user.team ? (
              <p className="mt-2 text-sm text-muted">
                Joining a team or brokerage? Ask them for their invite link and open it while
                you&apos;re signed in — everything you&apos;ve already added comes with you.
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

  if (onATeam) {
    tabs.push({
      id: "team",
      label: orgWord === "brokerage" ? "Your brokerage" : "Your team",
      content: (
        <>
          <Card
            title="People"
            icon={Users}
            description={
              canManage
                ? `Everyone in your ${orgWord}. Changing someone to Team lead or Admin lets them see everyone's transactions.`
                : `Everyone in your ${orgWord}.`
            }
          >
            <div className="flex flex-col gap-2">
              {members.map((teammate) => (
                <MemberRow
                  key={teammate.id}
                  member={teammate}
                  isYou={teammate.id === user.id}
                  canManage={canManage}
                  orgWord={orgWord}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">
              Managers see everyone&apos;s transactions — properties, dates, commission and
              documents. Nobody, at any role, can see another person&apos;s clients, income and
              expenses, mileage or anything under Finances.
            </p>
          </Card>

          {canManage ? (
            <>
              <Card
                title={`Add someone to your ${orgWord}`}
                description="Generate a private link, then send it however you like. It works whether they're new to Realty Labz or already have an account."
              >
                <div className="max-w-md">
                  <InviteForm canInviteAdmin={user.role === "BROKER"} />
                </div>
              </Card>

              <Card title="Invites waiting to be used">
                <InviteList invites={pendingInvites} />
              </Card>
            </>
          ) : null}
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
