import { NextRequest, NextResponse } from "next/server";
import { buildForecast } from "@/lib/forecast";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import { inServiceArea, quantizePoint } from "@/lib/geo";
import type { LngLat } from "@/lib/types";

function parseLngLat(s: string | null, fallback: LngLat): LngLat {
  if (s) {
    const [lng, lat] = s.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return quantizePoint({ lng, lat });
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = parseLngLat(sp.get("o"), DEFAULT_ORIGIN);
  const d = parseLngLat(sp.get("d"), DEFAULT_DEST);
  // This route fans out to 13 paid Mapbox calls; don't run it for coordinates
  // no real Topsail-bound user would send.
  if (!inServiceArea(o) || !inServiceArea(d)) return new NextResponse(null, { status: 400 });
  const fc = await buildForecast(o, d);
  return NextResponse.json(fc, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
