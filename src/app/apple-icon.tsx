import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0071e3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="130" height="130" viewBox="0 0 100 100">
          <path d="M50 25 L78 57 L22 57 Z" fill="#ffffff" />
          <rect x="30" y="57" width="40" height="19" rx="4" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
