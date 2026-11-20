"use client";

import { useEffect } from "react";

// Catches errors thrown above the (app)/(auth) route groups -- e.g. in this
// root layout itself. Next.js requires this file to render its own <html>/
// <body> since it replaces the root layout entirely when active, so it can't
// rely on anything from layout.tsx. Kept deliberately simple (plain <a>, no
// shared UI primitives) since something has already gone wrong above the
// normal app tree.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-24 text-center"
          style={{ background: "#ffffff", color: "#16192e", fontFamily: "system-ui, sans-serif" }}
        >
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm" style={{ color: "#5c6178" }}>
            Something unexpected happened. Try again, or go back to the homepage.
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ background: "#0b6fb8" }}
            >
              Try again
            </button>
            {/* Plain <a>, not <Link> -- deliberate, see the file-level
                comment above: this boundary can't rely on the router. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium"
              style={{ borderColor: "#e4e6ee", color: "#16192e" }}
            >
              Back to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
