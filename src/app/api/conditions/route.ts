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
    closures: "Closure",
    disabledVehicle: "Disabled vehicle",
    weatherCondition: "Weather",
  };
  return map[t] ?? titleCase(t);
}

// --- DriveNC schedule handling ---------------------------------------------
// Event records carry epoch StartDate/PlannedEndDate plus RecurrenceSchedules
// (date range, days of week, time-of-day windows). Season-long records like
// "Friday concerts on Roland Ave" or overnight-only roadwork are only real
// for a few hours a week — without honoring the schedule they sit in the
// alert list around the clock.

type RecurrenceSchedule = {
  StartDate?: string; // "7/3/2026 8:00:00 AM-04:00:00"
  EndDate?: string;
  Times?: Array<{ StartTime?: string; EndTime?: string }>; // "16:00:00-04:00:00"
  DaysOfWeek?: string[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The trailing "-04:00:00" is a UTC offset. Returns signed seconds, or null.
function parseOffset(s: string): number | null {
  const m = s.match(/([+-])(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? (Number(m[2]) * 3600 + Number(m[3]) * 60) * (m[1] === "-" ? -1 : 1) : null;
}

function schedDateEpoch(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/);
  if (!m) return null;
  let h = Number(m[4]) % 12;
  if (m[7] === "PM") h += 12;
  const offset = parseOffset(s) ?? -4 * 3600;
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h, Number(m[5]), Number(m[6])) / 1000 - offset;
}

function hmsSeconds(s?: string): number | null {
  const m = s?.match(/^(\d{2}):(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function isActiveNow(schedules: RecurrenceSchedule[] | undefined, nowSec: number): boolean {
  if (!Array.isArray(schedules) || schedules.length === 0) return true;
  for (const s of schedules) {
    const from = schedDateEpoch(s.StartDate);
    const to = schedDateEpoch(s.EndDate);
    if (from != null && nowSec < from) continue;
    if (to != null && nowSec > to) continue;
    // Evaluate day-of-week and time-of-day on the schedule's own clock.
    const offset = (s.StartDate ? parseOffset(s.StartDate) : null) ?? -4 * 3600;
    const local = new Date((nowSec + offset) * 1000);
    if (s.DaysOfWeek?.length && !s.DaysOfWeek.includes(DAY_NAMES[local.getUTCDay()])) continue;
    if (!s.Times?.length) return true;
    const sod = local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds();
    for (const t of s.Times) {
      const a = hmsSeconds(t.StartTime);
      const b = hmsSeconds(t.EndTime);
      if (a == null || b == null) return true;
      if (a <= b ? sod >= a && sod <= b : sod >= a || sod <= b) return true;
    }
  }
  return false;
}

// "Fri 8:00a – 11:00p" in Eastern time, for labeling upcoming windows.
function windowLabel(startSec: number, endSec?: number): string {
  const part = (sec: number, withDay: boolean) => {
    const d = new Date(sec * 1000);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(d);
    const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
      .format(d)
      .toLowerCase()
      .replace(/\s?([ap])m/, "$1");
    return withDay ? `${day} ${time}` : time;
  };
  if (!endSec || endSec <= startSec) return part(startSec, true);
  const sameDay = new Date(startSec * 1000).toDateString() === new Date(endSec * 1000).toDateString();
  return `${part(startSec, true)} – ${part(endSec, !sameDay)}`;
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

      // Only show what's real right now — plus a labeled heads-up for events
      // starting within 48h (e.g. a July 4th closure the day before).
      let when: string | null = null;
      const started = typeof e.StartDate !== "number" || e.StartDate <= now;
      if (!started) {
        if (e.StartDate - now > 48 * 3600) continue;
        when = windowLabel(e.StartDate, typeof e.PlannedEndDate === "number" ? e.PlannedEndDate : undefined);
      } else if (!isActiveNow(e.RecurrenceSchedules, now)) {
        continue;
      }

      const description = String(e.Description ?? "").replace(/\s+/g, " ").trim();
      const roads = e.RoadwayName ? [String(e.RoadwayName)] : [];
      const type = String(e.EventType ?? "event");
      const key = `${roads.join(",")}|${description}`;
      if (seen.has(key)) continue;
      const severe = type === "accident" || type === "closure" || type === "closures" || e.IsFullClosure === true;
      seen.set(key, {
        id: String(e.ID ?? key),
        type: labelType(type),
        roads,
        direction: e.DirectionOfTravel ?? null,
        description,
        severe,
        when,
      });
    }
    // Severe first; among equals, what's happening now before what's upcoming.
    return [...seen.values()].sort(
      (a, b) => Number(!!b.severe) - Number(!!a.severe) || Number(!!a.when) - Number(!!b.when),
    );
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
      const feat = f as {
        id?: string;
        geometry?: Geo;
        properties?: { core_details?: Record<string, unknown>; start_date?: string; end_date?: string };
      };
      const pts = coordsOf(feat.geometry ?? {});
      if (!pts.some(([lng, lat]) => inBox(lng, lat))) continue;
      // WZDx work zones carry ISO start/end dates; skip ended or far-future ones.
      const nowMs = Date.now();
      const start = Date.parse(feat.properties?.start_date ?? "");
      const end = Date.parse(feat.properties?.end_date ?? "");
      if (Number.isFinite(end) && end < nowMs) continue;
      if (Number.isFinite(start) && start - nowMs > 48 * 3600 * 1000) continue;
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
