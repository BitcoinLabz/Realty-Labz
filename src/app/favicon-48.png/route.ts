import { renderAppIcon } from "@/lib/app-icon";

// Served at /favicon.ico through a rewrite in next.config.ts: browsers and
// bookmark managers request that path by convention even when the page names
// another icon, and Next reserves a folder named "favicon.ico", so the route
// lives here instead. A PNG answers fine at that path everywhere that matters.
export function GET() {
  return renderAppIcon(48, { rounded: true });
}
