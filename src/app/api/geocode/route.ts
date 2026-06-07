import { NextRequest, NextResponse } from "next/server";
import { geocodeSearch, reverseGeocode } from "@/lib/mapbox";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = sp.get("lng");
  const lat = sp.get("lat");

  if (lng && lat) {
    const result = await reverseGeocode(Number(lng), Number(lat));
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const results = await geocodeSearch(sp.get("q") ?? "");
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
