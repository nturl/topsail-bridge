import { NextRequest } from "next/server";
import { congestionOverlays, routeWithCongestion, staticMapUrl } from "@/lib/mapbox";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import { inServiceArea, quantizePoint } from "@/lib/geo";
import type { LngLat } from "@/lib/types";

function parse(s: string | null, fallback: LngLat): LngLat {
  if (s) {
    const [lng, lat] = s.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return quantizePoint({ lng, lat });
  }
  return fallback;
}

// Proxies the Mapbox static map so the token stays server-side. The route is
// drawn with congestion overlays on a ~10 minute rhythm — the map is the
// illustration; the forecast numbers carry the freshness.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = parse(sp.get("o"), DEFAULT_ORIGIN);
  const d = parse(sp.get("d"), DEFAULT_DEST);
  const dark = sp.get("dark") === "1";
  if (!inServiceArea(o) || !inServiceArea(d)) return new Response(null, { status: 400 });

  const route = await routeWithCongestion(o, d);
  if (!route) return new Response(null, { status: 404 });

  const overlays = congestionOverlays(route.polyline, route.congestion);
  const img = await fetch(staticMapUrl(route.polyline, overlays, o, d, dark), { next: { revalidate: 600 } });
  if (!img.ok || !img.body) return new Response(null, { status: 502 });

  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
