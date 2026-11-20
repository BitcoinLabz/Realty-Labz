"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Car,
  FileText,
  Home,
  House,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/ui/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UpcomingDeadline } from "@/lib/finance-data";

// Flat and noun-shaped on purpose: the two things an agent works in every
// day (their transactions and their clients) used to be buried two levels
// deep inside "Forms", which meant creating a transaction took six unguided
// clicks. Every item carries an icon -- a wall of same-weight text is what
// non-technical users scan worst.
//
// Reorganised 2026-11-19 around what a busy agent reaches for: their deals
// and people first, then money (income & expenses, mileage, home office),
// then the paperwork they hand an accountant (Reports).
const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/finances", label: "Income & Expenses", icon: Wallet },
  { href: "/mileage", label: "Mileage", icon: Car },
  { href: "/home-office", label: "Home Office", icon: House },
  { href: "/reports", label: "Reports", icon: FileText },
];

const teamNavItem = { href: "/team", label: "Team", icon: Building2 };

// The oversight app (Broker / office Admin, 2026-10-01): their agents' work
// and nothing of their own -- no Dashboard, Clients or Finances.
const oversightNavItems = [
  { href: "/team", label: "Overview", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: Home },
  { href: "/team/settings", label: "Office", icon: SlidersHorizontal },
];

const accountNavItem = { href: "/account", label: "Settings", icon: Settings };

export function navItemsFor(opts: { oversight?: boolean; showTeamLink?: boolean }) {
  if (opts.oversight) return [...oversightNavItems, accountNavItem];
  if (opts.showTeamLink) return [...baseNavItems, teamNavItem, accountNavItem];
  return [...baseNavItems, accountNavItem];
}

export function Sidebar({
  userName,
  showTeamLink,
  oversight = false,
  upcomingDeadlines = [],
}: {
  userName?: string | null;
  showTeamLink?: boolean;
  oversight?: boolean;
  upcomingDeadlines?: UpcomingDeadline[];
}) {
  const pathname = usePathname();
  const navItems = navItemsFor({ oversight, showTeamLink });

  // The most specific matching item wins, so /team/settings lights up
  // "Office" rather than both it and "Overview" (/team).
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = navItems
    .map((item) => item.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  function isActive(href: string) {
    return href === activeHref;
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex items-center justify-between px-6 py-5">
          <Logo size="sm" href={oversight ? "/team" : "/dashboard"} />
          <NotificationBell deadlines={upcomingDeadlines} />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-6 py-4">
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <p className="mb-3 truncate text-sm text-muted">{userName}</p>
          <form action={logoutAction}>
            <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
    </aside>
  );
}
