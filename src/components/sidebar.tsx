"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  ClipboardSignature,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/ui/logo";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/forms", label: "Forms", icon: ClipboardSignature },
];

const teamNavItem = { href: "/team", label: "Team", icon: Building2 };

const accountNavItem = { href: "/account", label: "Account", icon: Settings };

export function Sidebar({
  userName,
  showTeamLink,
}: {
  userName?: string | null;
  showTeamLink?: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const navItems = showTeamLink
    ? [...baseNavItems, teamNavItem, accountNavItem]
    : [...baseNavItems, accountNavItem];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <Logo size="sm" />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
          className="text-foreground"
        >
          <Menu size={22} />
        </button>
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
          <Logo size="sm" />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="text-muted md:hidden"
          >
            <X size={20} />
          </button>
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
