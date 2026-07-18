import { auth } from "@/auth";
import { isManager } from "@/lib/authorization";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showTeamLink = !!session?.user && isManager(session.user.role) && !!session.user.teamId;

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <Sidebar userName={session?.user?.name} showTeamLink={showTeamLink} />
      <main className="flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
