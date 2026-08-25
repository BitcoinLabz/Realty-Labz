import { auth } from "@/auth";
import { isManager } from "@/lib/authorization";
import { getUpcomingDeadlines } from "@/lib/finance-data";
import { Sidebar } from "@/components/sidebar";
import { autoLogDueRecurringTransactions } from "@/app/actions/recurring-transactions";
import { sendDueDeadlineReminders } from "@/app/actions/deadline-reminders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showTeamLink = !!session?.user && isManager(session.user.role) && !!session.user.teamId;

  // Runs on every authenticated page view -- see the comment on
  // autoLogDueRecurringTransactions for why this lives here rather than on
  // a schedule: this app has no background jobs anywhere, so "on your next
  // visit" is how every other on-demand feature here already works.
  //
  // Each is wrapped separately and never rethrows. These are background
  // chores, and this layout wraps EVERY authenticated page -- an error in
  // one of them (a transient DB blip, or a migration not yet applied in
  // production) must not be able to take the whole app down. Failing here
  // means a reminder goes out late, which is recoverable; a blank site
  // isn't. Errors are logged, not swallowed silently, so a real problem is
  // still visible in the Vercel function logs.
  if (session?.user) {
    try {
      await autoLogDueRecurringTransactions(session.user.id);
    } catch (err) {
      console.error("[app-layout] autoLogDueRecurringTransactions failed", err);
    }
    try {
      await sendDueDeadlineReminders(session.user.id);
    } catch (err) {
      console.error("[app-layout] sendDueDeadlineReminders failed", err);
    }
  }

  let upcomingDeadlines: Awaited<ReturnType<typeof getUpcomingDeadlines>> = [];
  if (session?.user) {
    try {
      upcomingDeadlines = await getUpcomingDeadlines(session.user.id);
    } catch (err) {
      // Only feeds the sidebar notification bell -- an empty bell is a far
      // better outcome than an unusable app.
      console.error("[app-layout] getUpcomingDeadlines failed", err);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <Sidebar
        userName={session?.user?.name}
        showTeamLink={showTeamLink}
        upcomingDeadlines={upcomingDeadlines}
      />
      <main className="flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
