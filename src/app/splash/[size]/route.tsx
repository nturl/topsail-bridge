import { ImageResponse } from "next/og";

// iOS launch screens (apple-touch-startup-image): the TI oval on the coastal
// gradient instead of a white flash. One handler serves every device size we
// declare in layout.tsx; all are prerendered at build.
export const dynamic = "force-static";

export const SPLASH_SIZES = [
  "1320x2868", // iPhone 16/17 Pro Max (440x956 @3x)
  "1290x2796", // iPhone 14/15 Pro Max, 15/16 Plus (430x932 @3x)
  "1284x2778", // iPhone 12/13 Pro Max (428x926 @3x)
  "1206x2622", // iPhone 16 Pro, 17 (402x874 @3x)
  "1179x2556", // iPhone 14 Pro, 15, 16 (393x852 @3x)
  "1170x2532", // iPhone 12, 13, 14 (390x844 @3x)
  "1125x2436", // iPhone X/XS, 11 Pro, 12/13 mini (375x812 @3x)
  "828x1792", // iPhone XR, 11 (414x896 @2x)
] as const;

export function generateStaticParams() {
  return SPLASH_SIZES.map((size) => ({ size }));
}

function splashArt(w: number) {
  const ovalW = Math.round(w * 0.46);
  const ovalH = Math.round(ovalW * 0.62);
  const border = Math.round(w * 0.012);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(w * 0.055),
        background: "linear-gradient(165deg,#7dd3fc,#0369a1)",
      }}
    >
      <div
        style={{
          width: ovalW,
          height: ovalH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: "50%",
          border: `${border}px solid #0f172a`,
        }}
      >
        <span style={{ fontSize: Math.round(ovalW * 0.4), fontWeight: 800, color: "#0f172a", letterSpacing: 2 }}>
          TI
        </span>
      </div>
      <span style={{ fontSize: Math.round(w * 0.055), fontWeight: 600, color: "#ffffff", letterSpacing: 1 }}>
        Topsail Traffic
      </span>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!(SPLASH_SIZES as readonly string[]).includes(size)) return new Response(null, { status: 404 });
  const [w, h] = size.split("x").map(Number);
  return new ImageResponse(splashArt(w), { width: w, height: h });
}
