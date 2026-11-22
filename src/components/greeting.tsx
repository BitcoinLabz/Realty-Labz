"use client";

import { useSyncExternalStore } from "react";

function partOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Local time, so "Good evening" matches the phone, not the server clock.
// The server render is just the name; the greeting fills in after hydration.
export function Greeting({ name, detail }: { name: string; detail?: string }) {
  const hello = useSyncExternalStore(
    () => () => {},
    () => `Good ${partOfDay(new Date())}, ${name}`,
    () => name,
  );
  const date = useSyncExternalStore(
    () => () => {},
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    () => "",
  );

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{hello}</h1>
      <p className="text-xs text-muted">
        {date || "Today"}
        {detail ? ` · ${detail}` : ""}
      </p>
    </div>
  );
}
