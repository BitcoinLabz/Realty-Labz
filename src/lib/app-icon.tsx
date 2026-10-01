import { ImageResponse } from "next/og";
import {
  LOGO_CHIMNEY_BUBBLES,
  LOGO_CHIMNEY_PATH,
  LOGO_HOUSE_PATH,
  LOGO_LIQUID_BUBBLES,
  LOGO_LIQUID_COLOR,
  LOGO_LIQUID_PATH,
  LOGO_STROKE_WIDTH,
  LOGO_TILE_FROM,
  LOGO_TILE_OUTLINE,
  LOGO_TILE_TO,
} from "@/components/ui/logo-mark";

// The brand-tile app icon as a PNG, at any size. One renderer behind every
// icon address (apple-icon.tsx, /apple-touch-icon.png, /favicon.ico,
// /icon-512.png) so they can never drift apart -- the July logo lingering on
// phones is what happens when icons are separate files.
//
// `rounded`: iOS applies its own mask, so the iPhone icon must be a full,
// square tile; everywhere else draws its own corners.
export function renderAppIcon(size: number, { rounded = false }: { rounded?: boolean } = {}) {
  const mark = Math.round(size * 0.78);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${LOGO_TILE_FROM} 0%, ${LOGO_TILE_TO} 100%)`,
          borderRadius: rounded ? Math.round(size * 0.22) : 0,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 100 100">
          <path
            d={LOGO_CHIMNEY_PATH}
            fill="none"
            stroke={LOGO_TILE_OUTLINE}
            strokeWidth={LOGO_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d={LOGO_LIQUID_PATH} fill={LOGO_LIQUID_COLOR} />
          {LOGO_LIQUID_BUBBLES.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#ffffff" fillOpacity={0.85} />
          ))}
          <path
            d={LOGO_HOUSE_PATH}
            fill="none"
            stroke={LOGO_TILE_OUTLINE}
            strokeWidth={LOGO_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {LOGO_CHIMNEY_BUBBLES.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={LOGO_LIQUID_COLOR} />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
