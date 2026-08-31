import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { roleLabel, teamLabel } from "@/lib/authorization";
import { AcceptInviteForm } from "./accept-invite-form";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [invite, session] = await Promise.all([
    prisma.teamInvite.findUnique({
      where: { id },
      // The roster only decides whether to say "brokerage" or "team" in the
      // copy below -- see teamLabel.
      include: { team: { include: { users: { select: { role: true } } } } },
    }),
    auth(),
  ]);

  // Whether to show the "add your license" field inline. Asked here rather
  // than sending them to Settings, where they'd lose the invite.
  const viewer = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { licenseNumber: true },
      })
    : null;

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invite not found</h1>
        <p className="mt-2 text-sm text-muted">
          This invite link is invalid or has expired. Ask your team lead or broker for a new one.
        </p>
      </div>
    );
  }

  const orgWord = teamLabel(invite.team.users);
  const teamName = invite.team.name;

  // Already signed in and already here -- nothing to do.
  if (session?.user?.teamId === invite.teamId) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">You&apos;re already on this {orgWord}</h1>
          <p className="mt-1 text-sm text-muted">Nothing else to do here.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:opacity-80">
          Go to your dashboard →
        </Link>
      </div>
    );
  }

  // Signed in but part of somewhere else. Deliberately a dead stop rather
  // than a silent switch -- moving an account between organisations changes
  // who can see its transactions, and that shouldn't happen from one click
  // on a link somebody sent you.
  if (session?.user?.teamId) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">You&apos;re already part of a team</h1>
          <p className="mt-2 text-sm text-muted">
            To join {teamName} instead, ask your current team to remove you first, then open this
            link again.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:opacity-80">
          Back to your dashboard →
        </Link>
      </div>
    );
  }

  // Signed in with no team: link the account they already have, rather than
  // making them abandon it and start over.
  if (session?.user) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Join {teamName} as {roleLabel(invite.role) === "agent" ? "an" : "a"}{" "}
            {roleLabel(invite.role)}?
          </h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re signed in as {session.user.email}.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border p-5 text-sm">
          <p className="text-foreground">
            <span className="font-medium">Your work comes with you.</span> Every transaction,
            date and document you&apos;ve already added stays exactly as it is.
          </p>
          <p className="text-foreground">
            <span className="font-medium">What {teamName} will see:</span> your transactions —
            properties, status, dates, commission, and the documents attached to them.
          </p>
          <p className="text-muted">
            <span className="font-medium text-foreground">What they won&apos;t see:</span> your
            clients, your income and expenses, your mileage, or anything under Finances. That
            stays yours alone.
          </p>
        </div>

        <AcceptInviteForm
          inviteId={invite.id}
          teamName={teamName}
          requiresBrokerageNumber={!!invite.team.brokerageNumber}
          needsLicenseNumber={!viewer?.licenseNumber}
        />
      </div>
    );
  }

  // Not signed in at all -- the original create-an-account flow.
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Join {teamName}</h1>
        <p className="mt-1 text-sm text-muted">
          Create your account to join the {orgWord}.
        </p>
      </div>
      <JoinForm
        inviteId={invite.id}
        teamName={teamName}
        requiresBrokerageNumber={!!invite.team.brokerageNumber}
      />
      <p className="text-center text-sm text-muted">
        Already have a Realty Labz account?{" "}
        <Link
          href={`/login?callbackUrl=/join/${invite.id}`}
          className="font-medium text-accent hover:opacity-80"
        >
          Log in to join
        </Link>
      </p>
    </div>
  );
}
