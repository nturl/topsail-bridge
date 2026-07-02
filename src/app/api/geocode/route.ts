import { NextRequest, NextResponse } from "next/server";
import { geocodeSearch, reverseGeocode } from "@/lib/mapbox";
import { quantize } from "@/lib/geo";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = sp.get("lng");
  const lat = sp.get("lat");

  if (lng && lat) {
    // ~11 m quantization keeps GPS jitter from busting the daily cache.
    const result = await reverseGeocode(quantize(Number(lng)), quantize(Number(lat)));
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const results = await geocodeSearch(sp.get("q") ?? "");
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
