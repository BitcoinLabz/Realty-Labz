import { renderAppIcon } from "@/lib/app-icon";

// iOS looks up this path when saving a site to the Home Screen.
export function GET() {
  return renderAppIcon(180);
}
