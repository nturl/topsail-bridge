// Server-only Mapbox helpers. The token never reaches the client: geocoding,
// route geometry, the static map image, and typical-week generation all run here.
import type { LngLat, Place } from "./types";
import { decodePolyline, encodePolyline } from "./polyline";

const TOKEN = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const TZ = "America/New_York";
const PROXIMITY = "-77.6,34.42"; // bias geocoding toward Topsail
// Keep results in southeastern NC (Wilmington up to Jacksonville) so a search
// like "harris teeter" lands locally instead of a same-named street elsewhere.
const BBOX = "-78.7,33.7,-77.0,35.2";

export const TYPICAL_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6a..9p

// Search Box API (not the old v5 geocoder): real POI/brand fuzzy matching
// ("foodlion" -> Food Lion) with results ranked by distance from the island.
export async function geocodeSearch(q: string, limit = 5): Promise<Place[]> {
  if (!q.trim() || !TOKEN) return [];
  const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(
    q,
  )}&access_token=${TOKEN}&limit=8&country=us&proximity=${PROXIMITY}&bbox=${BBOX}&types=poi,address,place,locality,neighborhood`;
  const r = await fetch(url, { next: { revalidate: 86_400 } });
  if (!r.ok) return [];
  const j = (await r.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        full_address?: string;
        place_formatted?: string;
        distance?: number; // meters from proximity point
        coordinates?: { longitude?: number; latitude?: number };
      };
    }>;
  };
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    const lng = p.coordinates?.longitude;
    const lat = p.coordinates?.latitude;
    if (lng == null || lat == null) continue;
    // The same venue often arrives from multiple data sources; collapse on
    // name + ~100 m grid.
    const key = `${(p.name ?? "").toLowerCase()}|${lng.toFixed(3)},${lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: p.name ?? q,
      address: p.full_address ?? p.place_formatted ?? p.name ?? q,
      lng,
      lat,
      distanceMi: p.distance != null ? Math.round((p.distance / 1609.34) * 10) / 10 : undefined,
    });
    if (out.length === limit) break;
  }
  return out;
}

export async function reverseGeocode(lng: number, lat: number): Promise<Place | null> {
  if (!TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&limit=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const f = ((await r.json()) as { features?: Array<{ text?: string; place_name?: string }> }).features?.[0];
  return f ? { label: f.text ?? "My location", address: f.place_name ?? "My location", lng, lat } : null;
}

// Route geometry plus per-segment congestion (driving-traffic only), so the
// static map can show where the slowdown actually is. Short cache: it's live.
export type CongestionRoute = { polyline: string; congestion: string[] };

export async function routeWithCongestion(o: LngLat, d: LngLat): Promise<CongestionRoute | null> {
  if (!TOKEN) return null;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${o.lng},${o.lat};${d.lng},${d.lat}?geometries=polyline&overview=full&annotations=congestion&access_token=${TOKEN}`;
  const r = await fetch(url, { next: { revalidate: 120 } });
  if (!r.ok) return null;
  const route = ((await r.json()) as {
    routes?: Array<{ geometry?: string; legs?: Array<{ annotation?: { congestion?: string[] } }> }>;
  })?.routes?.[0];
  if (!route?.geometry) return null;
  return { polyline: route.geometry, congestion: route.legs?.[0]?.annotation?.congestion ?? [] };
}

// Same palette family as the rest of the app: amber for slow, rose for stopped.
const CONGESTION_COLOR: Record<string, string> = {
  moderate: "f59e0b",
  heavy: "ef4444",
  severe: "dc2626",
};

function thin(pts: [number, number][], max = 60): [number, number][] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
}

// Merge consecutive congested segments into runs, each encoded as its own
// sub-polyline drawn over the base route.
export function congestionOverlays(poly: string, congestion: string[]): string[] {
  const pts = decodePolyline(poly);
  const runs: { color: string; pts: [number, number][] }[] = [];
  let cur: { color: string; pts: [number, number][] } | null = null;
  for (let i = 0; i < congestion.length && i + 1 < pts.length; i++) {
    const color = CONGESTION_COLOR[congestion[i]];
    if (!color) {
      cur = null;
      continue;
    }
    if (cur && cur.color === color) cur.pts.push(pts[i + 1]);
    else {
      cur = { color, pts: [pts[i], pts[i + 1]] };
      runs.push(cur);
    }
  }
  let overlays = runs
    .filter((r) => r.pts.length >= 2)
    .map((r) => `path-5+${r.color}-0.95(${encodeURIComponent(encodePolyline(thin(r.pts)))})`);
  // Static map URLs have a length budget; under pressure keep only the
  // heavy/severe runs (the ones worth seeing).
  if (overlays.join(",").length > 5000) {
    overlays = overlays.filter((o) => !o.includes("+f59e0b"));
  }
  return overlays;
}

const BRIDGE = { lng: -77.5463, lat: 34.4285 }; // Surf City high-rise bridge
export function staticMapUrl(poly: string, overlays: string[], o: LngLat, d: LngLat, dark: boolean): string {
  const style = dark ? "dark-v11" : "light-v11";
  const path = `path-5+0ea5e9-0.9(${encodeURIComponent(poly)})`;
  const pins = [
    `pin-s+1e293b(${o.lng},${o.lat})`,
    `pin-l+ef4444(${BRIDGE.lng},${BRIDGE.lat})`,
    `pin-s+16a34a(${d.lng},${d.lat})`,
  ].join(",");
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${[path, ...overlays, pins].join(",")}/auto/640x320@2x?padding=44&access_token=${TOKEN}`;
}

// --- typical-week generation for any route (predicted rhythm) ---
function nyParts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(date)) if (x.type !== "literal") p[x.type] = x.value;
  return p;
}
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

async function predictAt(coords: string, departStr: string): Promise<number | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}&depart_at=${encodeURIComponent(departStr)}`;
  const r = await fetch(url, { next: { revalidate: 86_400 } });
  if (!r.ok) return null;
  const route = ((await r.json()) as { routes?: Array<{ duration: number }> })?.routes?.[0];
  return route ? Math.round(route.duration / 60) : null;
}

export async function generateTypical(o: LngLat, d: LngLat): Promise<Record<string, Record<string, number>>> {
  const grid: Record<string, Record<string, number>> = {};
  for (let dow = 0; dow < 7; dow++) grid[dow] = {};
  if (!TOKEN) return grid;

  const coords = `${o.lng},${o.lat};${d.lng},${d.lat}`;
  const start = new Date();
  const tasks: { dow: number; h: number; departStr: string }[] = [];
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const dt = new Date(start.getTime() + dayOffset * 86_400_000);
    const p = nyParts(dt);
    const dow = DOW[p.weekday];
    for (const h of TYPICAL_HOURS) {
      tasks.push({ dow, h, departStr: `${p.year}-${p.month}-${p.day}T${String(h).padStart(2, "0")}:00` });
    }
  }
  const BATCH = 10;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const slice = tasks.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((t) => predictAt(coords, t.departStr)));
    slice.forEach((t, j) => {
      if (res[j] != null) grid[String(t.dow)][String(t.h)] = res[j] as number;
    });
  }
  return grid;
}
