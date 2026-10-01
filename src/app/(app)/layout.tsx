import { auth } from "@/auth";
import { isManager, isOversightRole } from "@/lib/authorization";
import { getTeamUpcomingDeadlines, getUpcomingDeadlines } from "@/lib/finance-data";
import { Sidebar } from "@/components/sidebar";
import { autoLogDueRecurringTransactions } from "@/app/actions/recurring-transactions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showTeamLink = !!session?.user && isManager(session.user.role) && !!session.user.teamId;
  // Broker / office Admin: the oversight app (see proxy.ts for the redirects
  // that keep them out of the agent-only pages).
  const oversight = !!session?.user?.teamId && isOversightRole(session.user.role);

  // Runs on every authenticated page view -- see the comment on
  // autoLogDueRecurringTransactions for why this lives here rather than on
  // a schedule: this app has no background jobs anywhere, so "on your next
  // visit" is how every other on-demand feature here already works.
  //
  // Wrapped and never rethrows. This is a background chore, and this layout
  // wraps EVERY authenticated page -- an error here (a transient DB blip,
  // say) must not be able to take the whole app down. A recurring cost
  // logging late is recoverable; a blank site isn't. Logged, not swallowed
  // silently, so a real problem stays visible in the Vercel function logs.
  //
  // Deadline reminders deliberately do NOT run here: emails should only go
  // out when the agent presses "Send reminder" (founder decision), never as
  // a side effect of opening a page.
  // An agent's finances chore -- a broker in the oversight app has none.
  if (session?.user && !oversight) {
    try {
      await autoLogDueRecurringTransactions(session.user.id);
    } catch (err) {
      console.error("[app-layout] autoLogDueRecurringTransactions failed", err);
    }
  }

  let upcomingDeadlines: Awaited<ReturnType<typeof getUpcomingDeadlines>> = [];
  if (session?.user) {
    try {
      upcomingDeadlines = oversight
        ? await getTeamUpcomingDeadlines(session.user.teamId!)
        : await getUpcomingDeadlines(session.user.id);
    } catch (err) {
      // Only feeds the sidebar notification bell -- an empty bell is a far
      // better outcome than an unusable app.
      console.error("[app-layout] getUpcomingDeadlines failed", err);
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        userName={session?.user?.name}
        showTeamLink={showTeamLink}
        oversight={oversight}
        upcomingDeadlines={upcomingDeadlines}
      />
      {/* min-w-0 lets wide content scroll inside the page instead of pushing
          past the screen; pl-[4.5rem] is the 56px phone icon rail (sidebar.tsx)
          plus a 16px gutter. */}
      <main className="min-w-0 flex-1 py-8 pl-[4.5rem] pr-4 sm:pr-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
