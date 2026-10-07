import { Eye, KeyRound, Sparkles, User, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canManageMembership,
  roleLabel,
  teamLabel,
  wouldLeaveTeamUnmanaged,
  isOversightRole,
} from "@/lib/authorization";
import { Card } from "@/components/ui/card";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { InviteForm } from "./invite-form";
import { InviteByLicenseForm } from "./invite-by-license-form";
import { LeaveTeamForm } from "./leave-team-form";
import { FinanceSharingForm } from "./finance-sharing-form";
import { BrokerageSettingsForm } from "./brokerage-settings-form";
import { DigestToggle } from "./digest-toggle";
import { PlanCard } from "./plan-card";
import { getUserPlan, storageUsedBytes } from "@/lib/user-plan";
import { formatBytes, PRO_FEATURES, PRO_PRICE } from "@/lib/plan";
import { InviteList, type PendingInvite } from "./invite-list";
import { MemberRow } from "./member-row";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { upgraded } = await searchParams;
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

  // Same rule the server enforces in leaveTeamAction, asked here so the UI
  // and the action can't disagree about who is allowed to walk out.
  const canLeave = onATeam && !wouldLeaveTeamUnmanaged(members, user.id, null);

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
              <ProfileForm
                name={user.name ?? ""}
                email={user.email}
                licenseNumber={user.licenseNumber ?? ""}
              />
            </div>
          </Card>

          <Card title="Account type">
            <p className="text-sm text-muted">
              {user.team
                ? isOversightRole(user.role)
                  ? `You're the ${roleLabel(user.role)} of ${user.team.name}. You oversee your agents' shared transactions and run the office checklist — you don't carry transactions of your own here.`
                  : `You're part of ${user.team.name} as ${roleLabel(user.role)}.`
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

  // Plan & storage (2026-10-05). Its id doubles as the #plan link target used
  // by upgrade prompts around the app.
  const [plan, used] = await Promise.all([getUserPlan(user.id), storageUsedBytes(user.id)]);
  const fmt = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  tabs.push({
    id: "plan",
    label: "Plan",
    content: (
      <Card title="Your plan" icon={Sparkles}>
        <PlanCard
          isPro={plan?.isPro ?? false}
          comped={plan?.compedPro ?? false}
          hasBillingAccount={!!plan?.stripeCustomerId}
          renewsOn={plan?.isPro && !plan.cancelAtPeriodEnd ? fmt(plan.currentPeriodEnd) : null}
          cancelsOn={plan?.isPro && plan.cancelAtPeriodEnd ? fmt(plan.currentPeriodEnd) : null}
          usedLabel={formatBytes(used)}
          limitLabel={plan?.storageLimit ? formatBytes(plan.storageLimit) : null}
          usedPercent={plan?.storageLimit ? Math.round((used / plan.storageLimit) * 100) : null}
          features={PRO_FEATURES}
          prices={PRO_PRICE}
          justUpgraded={upgraded === "1"}
        />
      </Card>
    ),
  });

  if (onATeam) {
    // Broker / office Admin: their brokerage is what Account is for, so its
    // tab opens first. Everyone else keeps their own details first.
    tabs[isOversightRole(user.role) ? "unshift" : "push"]({
      id: "team",
      label: orgWord === "brokerage" ? "Your brokerage" : "Your team",
      content: (
        <>
          {/* Adding agents is the first thing a broker comes here for, so it
              leads the tab rather than sitting under the roster. */}
          {canManage ? (
            <>
              <Card
                title="Invite by license number"
                description="If they already use Realty Labz, this emails the invitation straight to them — no link to copy or chase."
              >
                <div className="max-w-md">
                  <InviteByLicenseForm canInviteAdmin={user.role === "BROKER"} />
                </div>
              </Card>

              <Card
                title="Or share a link"
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

          <Card
            title="People"
            icon={Users}
            description={
              canManage
                ? `Everyone in your ${orgWord}. A Team lead also sees agents' shared transactions; an Admin is office staff with the brokerage view only.`
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
              Managers see agents&apos; transactions — properties, dates, commission and
              documents. Every transaction is shared unless its agent switches sharing off on
              that one file. Nothing under Finances is shared unless the agent chooses to share
              it, and clients are never shared.
            </p>
          </Card>

          {/* The office's morning email -- only the oversight roles get it. */}
          {isOversightRole(user.role) ? (
            <Card title="Morning email">
              <DigestToggle on={user.dailyDigest} />
            </Card>
          ) : null}

          {canManage ? (
            <Card
              title={orgWord === "brokerage" ? "Brokerage details" : "Team details"}
              description="Shown to agents on their invite, and on your Overview."
            >
              <div className="max-w-md">
                <BrokerageSettingsForm
                  name={user.team!.name}
                  brokerageNumber={user.team!.brokerageNumber ?? ""}
                />
              </div>
            </Card>
          ) : null}

          {/* An agent's choice about their own finances -- a broker or office
              admin in the oversight app has none to share. */}
          {isOversightRole(user.role) ? null : (
            <Card
              title="What your brokerage can see"
              icon={Eye}
              description="Off by default. Nothing here is shared until you turn it on, and you can turn it back off at any time."
            >
              <div className="max-w-lg">
                <FinanceSharingForm
                  orgWord={orgWord}
                  shareBusinessFinances={user.shareBusinessFinances}
                  shareMileage={user.shareMileage}
                />
              </div>
            </Card>
          )}


          {/* Hidden rather than shown-and-refused: the server blocks the last
              manager from leaving, and offering a button that always fails is
              worse than not offering it. The explanation stands in for it. */}
          {canLeave ? (
            <Card
              title="Leaving"
              description="If you move on, your account and everything on it goes with you."
            >
              <LeaveTeamForm orgWord={orgWord} teamName={user.team!.name} />
            </Card>
          ) : (
            <Card title="Leaving">
              <p className="text-sm text-muted">
                You&apos;re the only person who can manage this {orgWord}, so you can&apos;t leave
                it — there&apos;d be nobody left to invite or remove anyone. Promote someone to
                admin first.
              </p>
            </Card>
          )}
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
