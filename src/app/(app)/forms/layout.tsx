"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Forms is now only the reusable-paperwork section. Clients and transactions
// used to be tabs here too, which is why the core object was so hard to
// find -- both are top-level nav items now.
const tabs = [
  { href: "/forms/templates", label: "Ready-to-send forms" },
  { href: "/forms/library", label: "Contract library" },
  { href: "/forms/deadline-sets", label: "Deadline sets" },
];

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/forms/library")
    ? "/forms/library"
    : pathname.startsWith("/forms/deadline-sets")
      ? "/forms/deadline-sets"
      : "/forms/templates";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
        <p className="mt-1 text-sm text-muted">
          Your brokerage&apos;s contracts, and the ready-to-send versions you email clients to
          sign.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab.href === active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
