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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-gray-500">
            An unexpected error occurred. You can try again, or head back to the homepage.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Back to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
