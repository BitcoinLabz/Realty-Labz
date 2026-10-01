import { renderAppIcon } from "@/lib/app-icon";

// Large icon for Android "Add to Home screen" and install prompts (manifest).
export function GET() {
  return renderAppIcon(512, { rounded: true });
}
