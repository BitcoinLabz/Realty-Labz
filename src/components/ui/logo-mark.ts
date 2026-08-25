// The Realty Labz mark: a house whose interior is a lab flask filling with
// liquid, bubbles rising out of the chimney. Shared here because the same
// shapes are rendered in four places (the sidebar/auth logo, the iOS home
// screen icon, the social preview image, and the browser tab favicon) and
// they drifted out of sync under the previous logo.
//
// Deliberately no <clipPath>: the liquid path below is already shaped to sit
// inside the walls, because next/og (Satori), which renders apple-icon.tsx
// and opengraph-image.tsx, has only partial clip-path support. One geometry
// that works everywhere beats two that have to be kept in agreement.
//
// Every x below was narrowed 20% toward the centre line (x=50) on
// 2026-08-25: newX = 50 + (oldX - 50) * 0.8. Heights are untouched, so the
// house reads taller and slimmer. Keep that transform in mind before nudging
// any single coordinate -- the shapes only line up because they were all
// scaled together.
//
// src/app/icon.svg is a static file and can't import this — it carries a
// copy of these same paths and a comment pointing back here.

// Outer outline: left eave -> apex -> right eave -> down the right wall ->
// rounded flask bottom -> back up the left wall. Spans x=22.8..77.2.
export const LOGO_HOUSE_PATH =
  "M22.8 48 L50 17 L77.2 48 L77.2 70 Q77.2 80 69.2 80 L30.8 80 Q22.8 80 22.8 70 Z";

// Open path (up, across, down) so the roofline drawn over it hides the base.
// The y values are unchanged: scaling x uniformly about the centre preserves
// each point's position along the roof slope, so it still meets the roofline.
export const LOGO_CHIMNEY_PATH = "M63.6 32 L63.6 25 L70.8 25 L70.8 40";

// Wavy surface, then straight down the inside of the walls to the bottom.
// Inset ~2 so it tucks under the centered 5.6-wide stroke with a little
// overlap -- matching the half-stroke exactly leaves a hairline gap.
export const LOGO_LIQUID_PATH =
  "M24.8 51 C34 45 40.4 57 50 51 C59.6 45 66 55 75.2 49 L75.2 70 Q75.2 77.5 69.2 77.5 L30.8 77.5 Q24.8 77.5 24.8 70 Z";

// Bubbles escaping the chimney, and the highlights suspended in the liquid.
export const LOGO_CHIMNEY_BUBBLES = [
  { cx: 74, cy: 9, r: 4.5 },
  { cx: 67.6, cy: 17, r: 2.5 },
  { cx: 79.6, cy: 17, r: 3 },
];

export const LOGO_LIQUID_BUBBLES = [
  { cx: 37.2, cy: 62, r: 4 },
  { cx: 45.2, cy: 57, r: 2.5 },
  { cx: 46.8, cy: 70, r: 2 },
  { cx: 34, cy: 55, r: 1.8 },
];

export const LOGO_STROKE_WIDTH = 5.6;

// The liquid keeps the same cyan in both themes -- it reads against white and
// black alike. Only the outline has to flip, since navy on a dark background
// would disappear entirely.
export const LOGO_LIQUID_COLOR = "#5BC5F2";
export const LOGO_OUTLINE_LIGHT = "#16192E";
export const LOGO_OUTLINE_DARK = "#F5F5F7";
