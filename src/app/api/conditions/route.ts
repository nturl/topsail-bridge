import { NextResponse } from "next/server";

// NCDOT work-zone feed (keyless, WZDx 4.1 GeoJSON).
const WZDX = "https://www.drivenc.gov/api/wzdx";

// Corridor box: Topsail Beach <-> Surf City bridge <-> Hampstead (US-17), tight
// enough to exclude unrelated US-17 work zones further up/down the coast.
const BBOX = { minLng: -77.72, maxLng: -77.52, minLat: 34.34, maxLat: 34.47 };

type Incident = {
  id: string;
  type: string;
  roads: string[];
  direction: string | null;
  description: string;
};
type Weather = {
  tempF: number;
  precipIn: number;
  code: number;
  windMph: number;
} | null;

function inBox(lng: number, lat: number): boolean {
  return lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat;
}

function coordsOf(geometry: unknown): [number, number][] {
  const g = geometry as { type?: string; coordinates?: unknown };
  if (!g?.coordinates) return [];
  const c = g.coordinates;
  if (g.type === "Point") return [c as [number, number]];
  if (g.type === "LineString") return c as [number, number][];
  if (g.type === "MultiLineString") return (c as [number, number][][]).flat();
  return [];
}

async function getIncidents(): Promise<Incident[]> {
  try {
    const r = await fetch(WZDX, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = (await r.json()) as { features?: unknown[] };
    // WZDx splits one work zone into many road segments; dedupe by road+text.
    const seen = new Map<string, Incident>();
    for (const f of j.features ?? []) {
      const feat = f as { id?: string; geometry?: unknown; properties?: { core_details?: Record<string, unknown> } };
      const pts = coordsOf(feat.geometry);
      if (!pts.some(([lng, lat]) => inBox(lng, lat))) continue;
      const cd = feat.properties?.core_details ?? {};
      const description = String(cd.description ?? "").replace(/\s+/g, " ").trim();
      const roads = (cd.road_names as string[]) ?? [];
      const key = `${roads.join(",")}|${description}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        id: String(feat.id ?? key),
        type: String(cd.event_type ?? "work-zone"),
        roads,
        direction: (cd.direction as string) ?? null,
        description,
      });
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}

async function getWeather(): Promise<Weather> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=34.43&longitude=-77.55&current=temperature_2m,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";
    const r = await fetch(url, { next: { revalidate: 600 } });
    if (!r.ok) return null;
    const c = ((await r.json()) as { current?: Record<string, number> }).current;
    if (!c) return null;
    return {
      tempF: Math.round(c.temperature_2m),
      precipIn: c.precipitation,
      code: c.weather_code,
      windMph: Math.round(c.wind_speed_10m),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [all, weather] = await Promise.all([getIncidents(), getWeather()]);
  const incidents = all.slice(0, 8);
  const omitted = Math.max(0, all.length - incidents.length);
  return NextResponse.json(
    { incidents, omitted, weather },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
