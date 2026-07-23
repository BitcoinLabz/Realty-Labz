import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-surface px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo size="lg" />
        <p className="text-lg text-muted">
          Finances, mileage deductions, and client documents in one place — built for Michigan
          real estate agents.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={session ? "/dashboard" : "/signup"}>
            <Button>{session ? "Go to dashboard" : "Get started"}</Button>
          </Link>
          {!session ? (
            <Link href="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
