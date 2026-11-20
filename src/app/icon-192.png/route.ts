import { renderAppIcon } from "@/lib/app-icon";

// 192px icon required by the web app manifest for Add to Home Screen.
export function GET() {
  return renderAppIcon(192, { rounded: true });
}
