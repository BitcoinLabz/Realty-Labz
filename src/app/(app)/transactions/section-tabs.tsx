"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The Transactions section's own tools, next to the transactions they serve.
// Deadline sets and the contract library used to be tabs under Forms, which
// was retired 2026-09-27. Shown on these three list pages only -- a single
// transaction's page is about that one property.
const tabs = [
  { href: "/transactions", label: "Transactions" },
  { href: "/transactions/deadline-sets", label: "Deadline sets" },
  { href: "/transactions/library", label: "Contract library" },
];

export function TransactionsTabs() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto">
      <div className="flex w-max gap-1 rounded-full border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              pathname === tab.href
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
