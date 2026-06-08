import type { ReactElement } from "react";

// Shared app-icon art: the Topsail Island "TI" oval on the app's coastal
// gradient. Scales by size; used by the favicon, apple icon, and PWA icons.
export function iconArt(size: number): ReactElement {
  const ovalW = Math.round(size * 0.8);
  const ovalH = Math.round(size * 0.54);
  const border = Math.max(2, Math.round(size * 0.045));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(155deg,#7dd3fc,#0369a1)",
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
        <span
          style={{
            fontSize: Math.round(size * 0.34),
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: Math.max(1, Math.round(size * 0.005)),
          }}
        >
          TI
        </span>
      </div>
    </div>
  );
}
