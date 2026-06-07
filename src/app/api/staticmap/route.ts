import { NextRequest } from "next/server";
import { routePolyline, staticMapUrl } from "@/lib/mapbox";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import type { LngLat } from "@/lib/types";

function parse(s: string | null, fallback: LngLat): LngLat {
  if (s) {
    const [lng, lat] = s.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
  }
  return fallback;
}

// Proxies the Mapbox static map so the token stays server-side.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = parse(sp.get("o"), DEFAULT_ORIGIN);
  const d = parse(sp.get("d"), DEFAULT_DEST);
  const dark = sp.get("dark") === "1";

  const poly = await routePolyline(o, d);
  if (!poly) return new Response(null, { status: 404 });

  const img = await fetch(staticMapUrl(poly, o, d, dark), { next: { revalidate: 3600 } });
  if (!img.ok || !img.body) return new Response(null, { status: 502 });

  return new Response(img.body, {
    headers: {
      "Content-Type": img.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
