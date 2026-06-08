import type { ReactElement } from "react";

// Shared app-icon art: the Topsail Island "TI" oval on the app's coastal
// gradient. Scales by size; used by the favicon, apple icon, and PWA icons.
export function iconArt(size: number): ReactElement {
  const ovalW = Math.round(size * 0.72);
  const ovalH = Math.round(size * 0.48);
  const border = Math.max(2, Math.round(size * 0.04));
  return (
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
      <div
        style={{
          width: ovalW,
          height: ovalH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: "50%",
          border: `${border}px solid #0f172a`,
        }}
      >
        <span style={{ fontSize: Math.round(size * 0.3), fontWeight: 800, color: "#0f172a" }}>TI</span>
      </div>
    </div>
  );
}
