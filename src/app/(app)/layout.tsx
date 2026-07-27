import { auth } from "@/auth";
import { isManager } from "@/lib/authorization";
import { Sidebar } from "@/components/sidebar";
import { autoLogDueRecurringTransactions } from "@/app/actions/recurring-transactions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showTeamLink = !!session?.user && isManager(session.user.role) && !!session.user.teamId;

  // Runs on every authenticated page view -- see the comment on
  // autoLogDueRecurringTransactions for why this lives here rather than on
  // a schedule: this app has no background jobs anywhere, so "on your next
  // visit" is how every other on-demand feature here already works.
  if (session?.user) {
    await autoLogDueRecurringTransactions(session.user.id);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <Sidebar userName={session?.user?.name} showTeamLink={showTeamLink} />
      <main className="flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
