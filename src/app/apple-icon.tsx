import { ImageResponse } from "next/og";
import {
  LOGO_CHIMNEY_BUBBLES,
  LOGO_CHIMNEY_PATH,
  LOGO_HOUSE_PATH,
  LOGO_LIQUID_BUBBLES,
  LOGO_LIQUID_COLOR,
  LOGO_LIQUID_PATH,
  LOGO_OUTLINE_LIGHT,
  LOGO_STROKE_WIDTH,
} from "@/components/ui/logo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          // Explicitly light, not transparent: iOS composites home-screen
          // icons onto its own mask and renders transparency as black, which
          // would swallow the navy outline.
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 100 100">
          <path
            d={LOGO_CHIMNEY_PATH}
            fill="none"
            stroke={LOGO_OUTLINE_LIGHT}
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
            stroke={LOGO_OUTLINE_LIGHT}
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
    { ...size },
  );
}
