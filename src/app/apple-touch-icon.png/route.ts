import { renderAppIcon } from "@/lib/app-icon";

// iOS (and some link previewers) request this exact path directly instead of
// reading the <link rel="apple-touch-icon"> tag. Without it they fall back to
// whatever icon they saved long ago -- which is how the July logo kept
// showing up. Same tile as apple-icon.tsx.
export function GET() {
  return renderAppIcon(180);
}
