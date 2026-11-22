"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { navItemsFor } from "@/components/sidebar";
import { Logo } from "@/components/ui/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UpcomingDeadline } from "@/lib/finance-data";

// Short labels for the thumb bar. The full names stay in the desktop sidebar
// and in the More sheet.
const TAB_LABEL: Record<string, string> = {
  "/dashboard": "Home",
  "/transactions": "Deals",
  "/clients": "Clients",
  "/finances": "Money",
  "/mileage": "Miles",
  "/home-office": "Office",
  "/reports": "Reports",
  "/team": "Team",
  "/team/settings": "Office",
  "/account": "Settings",
};

const hit =
  "flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function MobileNav({
  oversight,
  showTeamLink,
  userName,
  upcomingDeadlines,
  homeHref,
}: {
  oversight: boolean;
  showTeamLink: boolean;
  userName?: string | null;
  upcomingDeadlines: UpcomingDeadline[];
  homeHref: string;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const items = navItemsFor({ oversight, showTeamLink });

  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = items
    .map((item) => item.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];

  // Five tabs fit a thumb. Everything past the first four lives under More.
  const tabs = items.length <= 5 ? items : items.slice(0, 4);
  const overflow = items.length <= 5 ? [] : items.slice(4);
  const moreActive = overflow.some((item) => item.href === activeHref);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Logo size="sm" href={homeHref} />
        <div className="flex items-center gap-1">
          <NotificationBell deadlines={upcomingDeadlines} />
          <ThemeToggle compact />
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 h-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className={`grid h-14 ${overflow.length > 0 || tabs.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${hit} flex-col gap-0.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <Icon size={20} />
                {TAB_LABEL[item.href] ?? item.label}
              </Link>
            );
          })}
          {overflow.length > 0 ? (
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-expanded={more}
              className={`${hit} flex-col gap-0.5 text-[11px] font-medium ${moreActive ? "text-accent" : "text-muted"}`}
            >
              <MoreHorizontal size={20} />
              More
            </button>
          ) : null}
        </div>
      </nav>

      {more ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{userName ?? "Menu"}</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className={hit}>
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col">
              {overflow.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMore(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                      active ? "bg-accent/10 text-accent" : "text-foreground"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <form action={logoutAction} className="mt-2 border-t border-border pt-2">
              <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-muted">
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
