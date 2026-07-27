"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/finances", label: "Overview" },
  { href: "/finances/transactions", label: "Transactions" },
  { href: "/finances/mileage", label: "Mileage" },
  { href: "/finances/investments", label: "Investments" },
  { href: "/finances/loans", label: "Loans" },
  { href: "/finances/import", label: "Import" },
];

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finances</h1>
        <p className="mt-1 text-sm text-muted">
          Your real estate business and personal finances, all in one place.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
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
