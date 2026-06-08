import { NextResponse } from "next/server";
import type { Incident } from "@/lib/types";

// Richer incidents come from the keyed DriveNC event feed; if no key (or it
// fails) we fall back to the keyless WZDx work-zone feed.
const DRIVENC_KEY = process.env.DRIVENC_KEY;
const EVENTS_URL = DRIVENC_KEY ? `https://www.drivenc.gov/api/v2/get/event?key=${DRIVENC_KEY}` : null;
const WZDX = "https://www.drivenc.gov/api/wzdx";

// Corridor box: Topsail Beach <-> Surf City bridge <-> Hampstead.
const BBOX = { minLng: -77.72, maxLng: -77.52, minLat: 34.34, maxLat: 34.47 };

type Weather = { tempF: number; precipIn: number; code: number; windMph: number } | null;

function inBox(lng: number, lat: number): boolean {
  return lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat;
}

function titleCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelType(t: string): string {
  const map: Record<string, string> = {
    roadwork: "Roadwork",
    accident: "Accident",
    specialEvents: "Special event",
    congestion: "Heavy traffic",
    closure: "Closure",
    disabledVehicle: "Disabled vehicle",
    weatherCondition: "Weather",
  };
  return map[t] ?? titleCase(t);
}

async function driveNCIncidents(): Promise<Incident[] | null> {
  if (!EVENTS_URL) return null;
  try {
    const r = await fetch(EVENTS_URL, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr)) return null;
    const now = Date.now() / 1000;
    const seen = new Map<string, Incident>();
    for (const e of arr) {
      const lat = Number(e.Latitude);
      const lng = Number(e.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBox(lng, lat)) continue;
      if (typeof e.PlannedEndDate === "number" && e.PlannedEndDate > 0 && e.PlannedEndDate < now) continue;
      const description = String(e.Description ?? "").replace(/\s+/g, " ").trim();
      const roads = e.RoadwayName ? [String(e.RoadwayName)] : [];
      const type = String(e.EventType ?? "event");
      const key = `${roads.join(",")}|${description}`;
      if (seen.has(key)) continue;
      const severe = type === "accident" || type === "closure" || e.IsFullClosure === true;
      seen.set(key, {
        id: String(e.ID ?? key),
        type: labelType(type),
        roads,
        direction: e.DirectionOfTravel ?? null,
        description,
        severe,
      });
    }
    return [...seen.values()].sort((a, b) => Number(!!b.severe) - Number(!!a.severe));
  } catch {
    return null;
  }
}

type Geo = { type?: string; coordinates?: unknown };
function coordsOf(g: Geo): [number, number][] {
  if (!g?.coordinates) return [];
  const c = g.coordinates;
  if (g.type === "Point") return [c as [number, number]];
  if (g.type === "LineString") return c as [number, number][];
  if (g.type === "MultiLineString") return (c as [number, number][][]).flat();
  return [];
}

async function wzdxIncidents(): Promise<Incident[]> {
  try {
    const r = await fetch(WZDX, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = (await r.json()) as { features?: unknown[] };
    const seen = new Map<string, Incident>();
    for (const f of j.features ?? []) {
      const feat = f as { id?: string; geometry?: Geo; properties?: { core_details?: Record<string, unknown> } };
      const pts = coordsOf(feat.geometry ?? {});
      if (!pts.some(([lng, lat]) => inBox(lng, lat))) continue;
      const cd = feat.properties?.core_details ?? {};
      const description = String(cd.description ?? "").replace(/\s+/g, " ").trim();
      const roads = (cd.road_names as string[]) ?? [];
      const key = `${roads.join(",")}|${description}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        id: String(feat.id ?? key),
        type: "Roadwork",
        roads,
        direction: (cd.direction as string) ?? null,
        description,
        severe: false,
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
  const [dnc, weather] = await Promise.all([driveNCIncidents(), getWeather()]);
  const all = dnc ?? (await wzdxIncidents());
  const incidents = all.slice(0, 8);
  const omitted = Math.max(0, all.length - incidents.length);
  return NextResponse.json(
    { incidents, omitted, weather, source: dnc ? "drivenc" : "wzdx" },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
