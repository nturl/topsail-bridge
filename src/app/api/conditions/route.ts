import { NextResponse } from "next/server";
import type { Incident, Sun, TideEvent } from "@/lib/types";

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

// "h:mm" 24h -> compact chip clock ("3:01p").
function chipClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

// Now as "YYYY-MM-DD HH:mm" in Eastern, lexicographically comparable with the
// local timestamps NOAA returns.
function nyStamp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(", ", " ");
}

// NOAA Ocean City Beach fishing pier (8657419), ~3 mi from the bridge: the
// next high and low tide. Predictions are static, so a long revalidate is fine.
const TIDE_STATION = "8657419";

async function getTides(): Promise<TideEvent[] | null> {
  try {
    const today = nyStamp().slice(0, 10).replaceAll("-", "");
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&interval=hilo&datum=MLLW&station=${TIDE_STATION}&time_zone=lst_ldt&units=english&begin_date=${today}&range=36&format=json`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const rows = ((await r.json()) as { predictions?: Array<{ t: string; type: string }> }).predictions ?? [];
    const now = nyStamp();
    const events: TideEvent[] = [];
    const seen = new Set<string>();
    for (const p of rows) {
      if (p.t <= now) continue;
      const type = p.type === "H" ? "high" : "low";
      if (seen.has(type)) continue;
      seen.add(type);
      events.push({ type, clock: chipClock(p.t.slice(11)) });
      if (events.length === 2) break;
    }
    return events.length ? events : null;
  } catch {
    return null;
  }
}

async function getWeatherSun(): Promise<{ weather: Weather; sun: Sun | null }> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=34.43&longitude=-77.55&current=temperature_2m,precipitation,weather_code,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=America%2FNew_York&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";
    const r = await fetch(url, { next: { revalidate: 600 } });
    if (!r.ok) return { weather: null, sun: null };
    const j = (await r.json()) as {
      current?: Record<string, number>;
      daily?: { sunrise?: string[]; sunset?: string[] };
    };
    const c = j.current;
    const weather: Weather = c
      ? {
          tempF: Math.round(c.temperature_2m),
          precipIn: c.precipitation,
          code: c.weather_code,
          windMph: Math.round(c.wind_speed_10m),
        }
      : null;
    const sunrise = j.daily?.sunrise?.[0];
    const sunset = j.daily?.sunset?.[0];
    const sun =
      sunrise && sunset ? { sunriseClock: chipClock(sunrise.slice(11)), sunsetClock: chipClock(sunset.slice(11)) } : null;
    return { weather, sun };
  } catch {
    return { weather: null, sun: null };
  }
}

export async function GET() {
  const [dnc, ws, tides] = await Promise.all([driveNCIncidents(), getWeatherSun(), getTides()]);
  const all = dnc ?? (await wzdxIncidents());
  const incidents = all.slice(0, 8);
  const omitted = Math.max(0, all.length - incidents.length);
  return NextResponse.json(
    { incidents, omitted, weather: ws.weather, sun: ws.sun, tides, source: dnc ? "drivenc" : "wzdx" },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
