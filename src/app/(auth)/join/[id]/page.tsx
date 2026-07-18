import { prisma } from "@/lib/db";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const invite = await prisma.teamInvite.findUnique({
    where: { id },
    include: { team: true },
  });

  const isValid = invite && !invite.usedAt && invite.expiresAt > new Date();

  if (!invite || !isValid) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invite not found</h1>
        <p className="mt-2 text-sm text-muted">
          This invite link is invalid or has expired. Ask your team lead or broker for a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Join {invite.team.name}</h1>
        <p className="mt-1 text-sm text-muted">Create your account to join the team.</p>
      </div>
      <JoinForm inviteId={invite.id} />
    </div>
  );
}
