import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Topsail Traffic — when to leave Topsail Island";

// The wordmark uses the app's serif (Instrument Serif). Fetched once at build;
// if Google Fonts is unreachable we fall back to the default sans.
async function instrumentSerif(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap").then((r) =>
      r.text(),
    );
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const serif = await instrumentSerif();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(165deg,#7dd3fc 0%,#38bdf8 35%,#0369a1 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            height: 174,
            background: "#ffffff",
            borderRadius: "50%",
            border: "10px solid #0f172a",
            boxShadow: "0 24px 60px rgba(2,6,23,0.25)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 92, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: 2 }}>
              TI
            </span>
            <span style={{ fontSize: 21, color: "#0f172a", marginTop: 6 }}>Topsail Island, NC</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 116,
            fontFamily: serif ? "Instrument Serif" : undefined,
            fontWeight: serif ? 400 : 700,
            marginTop: 34,
            letterSpacing: serif ? 0 : -2,
            textShadow: "0 2px 24px rgba(2,6,23,0.18)",
          }}
        >
          Topsail Traffic
        </div>
        <div style={{ fontSize: 38, opacity: 0.94, marginTop: 6 }}>
          When to leave (and return to) Topsail Island
        </div>

        <div style={{ display: "flex", position: "relative", marginTop: 44, width: 280, height: 12 }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg,#16a34a,#eab308,#ef4444)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 50,
              top: -5,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "#ffffff",
              border: "4px solid #0f172a",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: serif
        ? [{ name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const }]
        : undefined,
    },
  );
}
