import { ImageResponse } from "next/og";

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
          <svg width={84} height={84} viewBox="0 0 100 100">
            <rect width="100" height="100" rx="24" fill="#0071e3" />
            <path d="M50 25 L78 57 L22 57 Z" fill="#ffffff" />
            <rect x="30" y="57" width="40" height="19" rx="4" fill="#ffffff" />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 600, color: "#1d1d1f" }}>Realty Labz</span>
        </div>
        <span style={{ fontSize: 30, color: "#86868b", maxWidth: 820, textAlign: "center" }}>
          Deals, e-signed contracts, clients, and your full financial picture — in one calm place.
        </span>
      </div>
    ),
    { ...size },
  );
}
