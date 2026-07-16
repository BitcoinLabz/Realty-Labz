import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { team: true },
  });

  if (!user) return null;

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
        <div className="mt-6 max-w-sm">
          <PasswordForm />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="text-base font-semibold text-foreground">Account type</h2>
        <p className="mt-2 text-sm text-muted">
          {user.team
            ? `You're on the ${user.team.name} team as ${
                user.role === "TEAM_LEAD" ? "team lead" : "an agent"
              }.`
            : "You have a solo account."}
        </p>
        {!user.team ? (
          <p className="mt-1 text-sm text-muted">
            Team features (inviting teammates, shared client access) are coming in a future
            update.
          </p>
        ) : null}
      </section>
    </div>
  );
}
