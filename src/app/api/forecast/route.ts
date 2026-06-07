import { NextRequest, NextResponse } from "next/server";
import { buildForecast } from "@/lib/forecast";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import type { LngLat } from "@/lib/types";

function parseLngLat(s: string | null, fallback: LngLat): LngLat {
  if (s) {
    const [lng, lat] = s.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = parseLngLat(sp.get("o"), DEFAULT_ORIGIN);
  const d = parseLngLat(sp.get("d"), DEFAULT_DEST);
  const fc = await buildForecast(o, d);
  return NextResponse.json(fc, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
