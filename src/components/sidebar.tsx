"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Home,
  LayoutDashboard,
  PanelLeft,
  Settings,
  Users,
  Wallet,
  X,
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
const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/finances", label: "Finances", icon: Wallet },
];

const teamNavItem = { href: "/team", label: "Team", icon: Building2 };

// The oversight app (Broker / office Admin, 2026-10-01): their agents' work
// and nothing of their own -- no Dashboard, Clients or Finances.
const oversightNavItems = [
  { href: "/team", label: "Overview", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: Home },
];

const accountNavItem = { href: "/account", label: "Account", icon: Settings };

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
  const [isOpen, setIsOpen] = useState(false);
  const navItems = oversight
    ? [...oversightNavItems, accountNavItem]
    : showTeamLink
      ? [...baseNavItems, teamNavItem, accountNavItem]
      : [...baseNavItems, accountNavItem];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials =
    (userName ?? "")
      .split(/s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";

  return (
    <>
      {/* Phones: a slim icon rail that's always there, like Claude's own
          site -- every section is one tap away without opening a menu first.
          The panel button at the top (or your initials) expands the full
          labelled menu below. Fixed, so the page scrolls beside it; the
          layout pads <main> by the same w-14. */}
      <div className="fixed inset-y-0 left-0 z-30 flex w-14 flex-col items-center border-r border-border bg-background py-3 md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <PanelLeft size={20} />
        </button>

        <nav className="mt-4 flex flex-1 flex-col items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-1.5">
          <NotificationBell deadlines={upcomingDeadlines} placement="rail" />
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Account menu"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground"
          >
            {initials}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-background transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <Logo size="sm" href={oversight ? "/team" : "/dashboard"} onClick={() => setIsOpen(false)} />
          <div className="flex items-center gap-4">
            <NotificationBell deadlines={upcomingDeadlines} />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="text-muted md:hidden"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
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
    </>
  );
}
