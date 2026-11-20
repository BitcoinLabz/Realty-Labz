import { renderAppIcon } from "@/lib/app-icon";

// Full-bleed icon with the mark inside the Android safe zone.
export function GET() {
  return renderAppIcon(512, { maskable: true });
}
