// Server-only Mapbox helpers. The token never reaches the client: geocoding,
// route geometry, the static map image, and typical-week generation all run here.
import type { LngLat, Place } from "./types";

const TOKEN = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const TZ = "America/New_York";
const PROXIMITY = "-77.6,34.42"; // bias geocoding toward Topsail
// Keep results in southeastern NC (Wilmington up to Jacksonville) so a search
// like "harris teeter" lands locally instead of a same-named street elsewhere.
const BBOX = "-78.7,33.7,-77.0,35.2";

export const TYPICAL_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6a..9p

export async function geocodeSearch(q: string, limit = 5): Promise<Place[]> {
  if (!q.trim() || !TOKEN) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    q,
  )}.json?access_token=${TOKEN}&limit=${limit}&country=us&proximity=${PROXIMITY}&bbox=${BBOX}&types=address,poi,place,locality,neighborhood`;
  const r = await fetch(url, { next: { revalidate: 86_400 } });
  if (!r.ok) return [];
  const j = (await r.json()) as { features?: Array<{ text?: string; place_name?: string; center: [number, number] }> };
  return (j.features ?? []).map((f) => ({
    label: f.text ?? f.place_name ?? q,
    address: f.place_name ?? q,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

export async function reverseGeocode(lng: number, lat: number): Promise<Place | null> {
  if (!TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&limit=1`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const f = ((await r.json()) as { features?: Array<{ text?: string; place_name?: string }> }).features?.[0];
  return f ? { label: f.text ?? "My location", address: f.place_name ?? "My location", lng, lat } : null;
}

export async function routePolyline(o: LngLat, d: LngLat): Promise<string | null> {
  if (!TOKEN) return null;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${o.lng},${o.lat};${d.lng},${d.lat}?geometries=polyline&overview=full&access_token=${TOKEN}`;
  const r = await fetch(url, { next: { revalidate: 3600 } });
  if (!r.ok) return null;
  return ((await r.json()) as { routes?: Array<{ geometry?: string }> })?.routes?.[0]?.geometry ?? null;
}

const BRIDGE = { lng: -77.5463, lat: 34.4285 }; // Surf City high-rise bridge
export function staticMapUrl(poly: string, o: LngLat, d: LngLat, dark: boolean): string {
  const style = dark ? "dark-v11" : "light-v11";
  const path = `path-5+0ea5e9-0.9(${encodeURIComponent(poly)})`;
  const pins = [
    `pin-s+1e293b(${o.lng},${o.lat})`,
    `pin-l+ef4444(${BRIDGE.lng},${BRIDGE.lat})`,
    `pin-s+16a34a(${d.lng},${d.lat})`,
  ].join(",");
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${path},${pins}/auto/640x320@2x?padding=44&access_token=${TOKEN}`;
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
