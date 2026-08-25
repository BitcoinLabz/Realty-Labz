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
// src/app/icon.svg is a static file and can't import this — it carries a
// copy of these same paths and a comment pointing back here.

// Outer outline: left eave -> apex -> right eave -> down the right wall ->
// rounded flask bottom -> back up the left wall.
export const LOGO_HOUSE_PATH = "M16 48 L50 17 L84 48 L84 70 Q84 80 74 80 L26 80 Q16 80 16 70 Z";

// Open path (up, across, down) so the roofline drawn over it hides the base.
export const LOGO_CHIMNEY_PATH = "M67 32 L67 25 L76 25 L76 40";

// Wavy surface, then straight down the inside of the walls to the bottom.
// Inset ~2.5 so it tucks under the centered 5.6-wide stroke with a little
// overlap -- matching the half-stroke exactly leaves a hairline gap.
export const LOGO_LIQUID_PATH =
  "M18.5 51 C30 45 38 57 50 51 C62 45 70 55 81.5 49 L81.5 70 Q81.5 77.5 74 77.5 L26 77.5 Q18.5 77.5 18.5 70 Z";

// Bubbles escaping the chimney, and the highlights suspended in the liquid.
export const LOGO_CHIMNEY_BUBBLES = [
  { cx: 80, cy: 9, r: 4.5 },
  { cx: 72, cy: 17, r: 2.5 },
  { cx: 87, cy: 17, r: 3 },
];

export const LOGO_LIQUID_BUBBLES = [
  { cx: 34, cy: 62, r: 4 },
  { cx: 44, cy: 57, r: 2.5 },
  { cx: 46, cy: 70, r: 2 },
  { cx: 30, cy: 55, r: 1.8 },
];

export const LOGO_STROKE_WIDTH = 5.6;

// The liquid keeps the same cyan in both themes -- it reads against white and
// black alike. Only the outline has to flip, since navy on a dark background
// would disappear entirely.
export const LOGO_LIQUID_COLOR = "#5BC5F2";
export const LOGO_OUTLINE_LIGHT = "#16192E";
export const LOGO_OUTLINE_DARK = "#F5F5F7";
