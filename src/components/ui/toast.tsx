"use client";

import { useEffect, useState } from "react";

// One confirmation for a save that otherwise just clears the form. Sits above
// the phone tab bar, and at the bottom corner on a desktop. `signal` changes
// on every successful submit so a second save shows the toast again.
export function Toast({ message, signal }: { message?: string | null; signal?: unknown }) {
  const [dismissed, setDismissed] = useState<unknown>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setDismissed(signal), 4000);
    return () => clearTimeout(timer);
  }, [message, signal]);

  if (!message || dismissed === signal) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 z-50 w-[min(100%-2rem,22rem)] -translate-x-1/2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
    >
      {message}
    </div>
  );
}
