import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/ui/logo";
import { Footer } from "@/components/footer";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Logo size="sm" href="/" />
          {session ? (
            <Link
              href="/dashboard"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Open app
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <Link href="/login" className="text-sm font-medium text-foreground hover:text-accent">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:px-4"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <Footer />
    </div>
  );
}
