import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bridge Watch — when to leave Topsail Island";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 90,
          background: "linear-gradient(160deg,#38bdf8,#0369a1)",
          color: "white",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 17 Q12 5 22 17" />
          <line x1="2" y1="17" x2="22" y2="17" />
          <line x1="7" y1="12.5" x2="7" y2="17" />
          <line x1="12" y1="10.5" x2="12" y2="17" />
          <line x1="17" y1="12.5" x2="17" y2="17" />
        </svg>
        <div style={{ fontSize: 88, fontWeight: 700, marginTop: 28, letterSpacing: -1 }}>Topsail Traffic</div>
        <div style={{ fontSize: 40, opacity: 0.92, marginTop: 6 }}>
          When to leave (and return to) Topsail Island
        </div>
      </div>
    ),
    { ...size },
  );
}
