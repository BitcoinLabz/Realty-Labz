import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Realty Labs
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Dashboard
            </Link>
            <Link
              href="/deals"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Deals
            </Link>
            <Link
              href="/transactions"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Finances
            </Link>
            <Link
              href="/clients"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Clients
            </Link>
            <Link
              href="/documents"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Documents
            </Link>
            <Link
              href="/account"
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              Account
            </Link>
            <span className="text-sm text-muted">{session?.user?.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
