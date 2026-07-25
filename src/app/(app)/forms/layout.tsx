"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/forms", label: "Clients" },
  { href: "/forms/templates", label: "Templates" },
];

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTemplatesTab = pathname.startsWith("/forms/templates");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your clients, and the contract templates you send them to sign.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => {
            const active = tab.href === "/forms/templates" ? isTemplatesTab : !isTemplatesTab;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
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
