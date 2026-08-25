"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import type { UpcomingDeadline } from "@/lib/finance-data";

export function NotificationBell({ deadlines }: { deadlines: UpcomingDeadline[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Upcoming deadlines"
        className="relative text-muted hover:text-foreground"
      >
        <Bell size={20} />
        {deadlines.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {deadlines.length}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-8 z-50 w-72 rounded-2xl border border-border bg-background p-3 shadow-lg">
            <p className="mb-2 px-2 text-sm font-semibold text-foreground">Due dates &amp; reminders</p>
            {deadlines.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted">Nothing due in the next 7 days.</p>
            ) : (
              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {deadlines.map((d) => (
                  <Link
                    key={d.id}
                    href={`/transactions/${d.dealId}`}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col rounded-xl px-2 py-2 hover:bg-surface"
                  >
                    <span className="text-sm font-medium text-foreground">{d.label}</span>
                    <span className="text-xs text-muted">{d.propertyAddress}</span>
                    <span className={`text-xs font-medium ${d.isOverdue ? "text-danger" : "text-muted"}`}>
                      {new Date(d.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {d.isOverdue ? " · Overdue" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
