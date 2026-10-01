import { renderAppIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iPhone Home Screen / banner icon. Full square tile: iOS applies its own
// rounded mask (see renderAppIcon).
export default function AppleIcon() {
  return renderAppIcon(180);
}
