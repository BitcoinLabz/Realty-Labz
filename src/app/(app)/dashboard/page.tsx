import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();
  const team = session?.user?.teamId
    ? await prisma.team.findUnique({ where: { id: session.user.teamId } })
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {team ? `${team.name} · Team account` : "Solo account"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Net income" value="$0.00" />
        <SummaryCard label="Mileage saved" value="$0.00" />
        <SummaryCard label="Clients" value="0" />
      </div>

      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm text-muted">
          Income &amp; expense tracking, mileage logging, client management, and document
          storage will show up here as they&apos;re built.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
