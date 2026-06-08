import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Topsail Traffic — when to leave Topsail Island";

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
          padding: 96,
          background: "linear-gradient(160deg,#38bdf8,#0369a1)",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 236,
            height: 152,
            background: "#ffffff",
            borderRadius: "50%",
            border: "9px solid #0f172a",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 80, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>TI</span>
            <span style={{ fontSize: 19, color: "#0f172a", marginTop: 5 }}>Topsail Island, NC</span>
          </div>
        </div>
        <div style={{ fontSize: 90, fontWeight: 700, marginTop: 40, letterSpacing: -1 }}>Topsail Traffic</div>
        <div style={{ fontSize: 40, opacity: 0.92, marginTop: 8 }}>
          When to leave (and return to) Topsail Island
        </div>
      </div>
    ),
    { ...size },
  );
}
