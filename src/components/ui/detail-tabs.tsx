"use client";

import { useEffect, useState } from "react";

// Generic client-side tab switcher for a detail page's stacked sections
// (client/deal detail pages) -- same pill-bar visual language already used
// for the top-level Finances/Forms sub-nav (finances/layout.tsx,
// forms/layout.tsx), just applied one level deeper so a page with many
// sections doesn't force scrolling past everything above whatever you
// actually came for.
export function DetailTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  // A link to "#some-tab-id" opens that tab, so one section can point to
  // another ("Go to Documents") without the reader hunting for it.
  //
  // The hash is cleared once used: left in the URL, the next server refresh
  // after a save would yank the reader back to that tab, and clicking the
  // same link twice would do nothing (no hashchange).
  const tabIds = tabs.map((t) => t.id).join(",");
  useEffect(() => {
    const ids = tabIds.split(",");
    function openFromHash() {
      const id = window.location.hash.slice(1);
      if (!ids.includes(id)) return;
      setActive(id);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [tabIds]);

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <div className="flex w-max gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab.id === active ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Every tab stays mounted, toggled with CSS rather than conditional
          JSX -- switching tabs must never silently discard in-progress
          input in an unsubmitted form on another tab (e.g. a half-filled
          "Add a deal" form). */}
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === active ? "flex flex-col gap-8" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
