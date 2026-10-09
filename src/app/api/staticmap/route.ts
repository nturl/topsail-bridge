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
  // Failures get a short CDN cache too, so a retry storm doesn't re-run Mapbox.
  const fail = (status: number) => new Response(null, { status, headers: { "Cache-Control": "public, s-maxage=60" } });
  if (!inServiceArea(o) || !inServiceArea(d)) return fail(400);

  const route = await routeWithCongestion(o, d);
  if (!route) return fail(404);

  const overlays = congestionOverlays(route.polyline, route.congestion);
  let img: Response;
  try {
    img = await fetch(staticMapUrl(route.polyline, overlays, o, d, dark), {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return fail(504);
  }
  if (!img.ok || !img.body) return fail(502);

  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
