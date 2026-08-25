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

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={96} height={96} viewBox="0 0 100 100">
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
          <span style={{ fontSize: 64, fontWeight: 600, color: "#1d1d1f" }}>Realty Labz</span>
        </div>
        <span style={{ fontSize: 30, color: "#86868b", maxWidth: 820, textAlign: "center" }}>
          Transactions, e-signed contracts, clients, and your full financial picture — in one calm
          place.
        </span>
      </div>
    ),
    { ...size },
  );
}
