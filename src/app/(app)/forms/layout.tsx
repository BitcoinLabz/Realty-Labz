"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/forms/files", label: "Files" },
  { href: "/forms", label: "Clients" },
  { href: "/forms/templates", label: "Templates" },
  { href: "/forms/library", label: "Library" },
];

// Order matters: check the most specific/nested paths before the bare
// "/forms" fallback, since every tab's href starts with "/forms".
function activeTabHref(pathname: string): string {
  if (pathname.startsWith("/forms/files")) return "/forms/files";
  if (pathname.startsWith("/forms/templates")) return "/forms/templates";
  if (pathname.startsWith("/forms/library")) return "/forms/library";
  return "/forms";
}

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = activeTabHref(pathname);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
        <p className="mt-1 text-sm text-muted">
          Every property&apos;s files, your clients, and the contract templates you send them to sign.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => {
            const isActive = tab.href === active;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
