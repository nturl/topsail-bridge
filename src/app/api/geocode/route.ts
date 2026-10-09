import { NextRequest, NextResponse } from "next/server";
import { geocodeSearch, reverseGeocode } from "@/lib/mapbox";
import { inServiceArea, quantize } from "@/lib/geo";

// Searches are public and stable: let browsers keep them an hour and the edge a
// day, so a repeated query never reaches Mapbox (each miss is billable).
const SEARCH_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = sp.get("lng");
  const lat = sp.get("lat");

  if (lng && lat) {
    // ~11 m quantization keeps GPS jitter from busting the daily cache.
    const p = { lng: quantize(Number(lng)), lat: quantize(Number(lat)) };
    // Outside the service box there is nothing useful to name, so skip the call.
    const result =
      Number.isFinite(p.lng) && Number.isFinite(p.lat) && inServiceArea(p) ? await reverseGeocode(p.lng, p.lat) : null;
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Normalize so "Surf  City" and "surf city" share one cache entry; cap length
  // so the route can't be used to send arbitrary payloads upstream.
  const q = (sp.get("q") ?? "").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 100);
  const results = q.length >= 3 ? await geocodeSearch(q) : [];
  return NextResponse.json({ results }, { headers: { "Cache-Control": SEARCH_CACHE } });
}
