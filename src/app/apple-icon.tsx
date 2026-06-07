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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg,#38bdf8,#0369a1)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round">
          <path d="M2 17 Q12 5 22 17" />
          <line x1="2" y1="17" x2="22" y2="17" />
          <line x1="7" y1="12.5" x2="7" y2="17" />
          <line x1="12" y1="10.5" x2="12" y2="17" />
          <line x1="17" y1="12.5" x2="17" y2="17" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
