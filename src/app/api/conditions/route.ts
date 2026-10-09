import { NextResponse } from "next/server";
import type { Beach, Incident, StormWatch, Sun, TideEvent, WeatherAlert } from "@/lib/types";

// Richer incidents come from the keyed DriveNC event feed; if no key (or it
// fails) we fall back to the keyless WZDx work-zone feed.
const DRIVENC_KEY = process.env.DRIVENC_KEY;
const EVENTS_URL = DRIVENC_KEY ? `https://www.drivenc.gov/api/v2/get/event?key=${DRIVENC_KEY}` : null;
const WZDX = "https://www.drivenc.gov/api/wzdx";

// Corridor box: Topsail Beach <-> Surf City bridge <-> Hampstead.
const BBOX = { minLng: -77.72, maxLng: -77.52, minLat: 34.34, maxLat: 34.47 };

type Weather = { tempF: number; precipIn: number; code: number; windMph: number; gustMph: number } | null;

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
  // Compare calendar days in Eastern time, not the server's timezone.
  const dayKey = (sec: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", dateStyle: "short" }).format(new Date(sec * 1000));
  const sameDay = dayKey(startSec) === dayKey(endSec);
  return `${part(startSec, true)} – ${part(endSec, !sameDay)}`;
}

async function driveNCIncidents(): Promise<Incident[] | null> {
  if (!EVENTS_URL) return null;
  try {
    const r = await fetch(EVENTS_URL, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
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

// Null (not []) on failure, so a dead feed can't pass for a clear road.
async function wzdxIncidents(): Promise<Incident[] | null> {
  try {
    const r = await fetch(WZDX, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
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
    return null;
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
    const r = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
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
      "https://api.open-meteo.com/v1/forecast?latitude=34.43&longitude=-77.55&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=sunrise,sunset&forecast_days=1&timezone=America%2FNew_York&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";
    const r = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
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
          gustMph: Math.round(c.wind_gusts_10m),
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

// --- NWS / NHC ---------------------------------------------------------------
// api.weather.gov asks every client to identify itself.
const NWS_HEADERS = { "User-Agent": "topsailtraffic.com", Accept: "application/geo+json" };

// Coastal Pender (Surf City, Topsail Beach) and Coastal Onslow (North Topsail).
const NWS_ZONES = "NCZ106,NCZ199";
const STORM_EVENT = /hurricane|tropical storm|storm surge|extreme wind|evacuation/i;

async function getAlerts(): Promise<WeatherAlert[]> {
  try {
    const r = await fetch(`https://api.weather.gov/alerts/active?zone=${NWS_ZONES}`, {
      headers: NWS_HEADERS,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    type Props = Record<string, string | null> & { affectedZones?: string[] };
    const j = (await r.json()) as { features?: { properties: Props }[] };
    const now = Date.now() / 1000;
    const byEvent = new Map<string, WeatherAlert>();
    // When both offices issue the same alert, keep Surf City's own zone.
    const surfCityFirst = [...(j.features ?? [])].sort(
      (a, b) =>
        Number(!!b.properties.affectedZones?.some((z) => z.endsWith("NCZ106"))) -
        Number(!!a.properties.affectedZones?.some((z) => z.endsWith("NCZ106"))),
    );
    for (const f of surfCityFirst) {
      const p = f.properties;
      const event = p.event ?? "";
      // Both zones usually carry the same alert from two NWS offices.
      if (!event || byEvent.has(event) || p.status !== "Actual") continue;
      const start = Date.parse(p.onset ?? p.effective ?? "") / 1000;
      const end = Date.parse(p.ends ?? p.expires ?? "") / 1000;
      if (Number.isFinite(end) && end < now) continue;
      const window =
        Number.isFinite(start) && start > now
          ? windowLabel(start, Number.isFinite(end) ? end : undefined)
          : Number.isFinite(end)
            ? `until ${windowLabel(end)}`
            : "in effect";
      byEvent.set(event, {
        id: String(p.id ?? event),
        event,
        severity: p.severity ?? "Unknown",
        window,
        storm: STORM_EVENT.test(event),
        warning: /warning|emergency/i.test(event),
      });
    }
    // Storm-level first, then warnings, then watches and advisories.
    return [...byEvent.values()].sort(
      (a, b) => Number(b.storm) - Number(a.storm) || Number(b.warning) - Number(a.warning),
    );
  } catch {
    return [];
  }
}

type RipRisk = Beach["rip"];
function ripOf(s: string | undefined): RipRisk | null {
  const m = s?.match(/\b(Low|Moderate|High)\b/i);
  if (!m) return null;
  return (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as RipRisk;
}

function periodName(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (name === "rest of today" || name === "today") return "Today";
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// NWS Wilmington's Surf Zone Forecast is plain text. The Coastal Pender block
// runs from "NCZ106-" to "$$"; each period starts on a ".NAME..." line.
async function getBeach(): Promise<Beach | null> {
  try {
    const r = await fetch("https://api.weather.gov/products/types/SRF/locations/ILM/latest", {
      headers: NWS_HEADERS,
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { issuanceTime?: string; productText?: string };
    // Only today's issue: the periods are relative to the day it was written,
    // and the forecast stops being issued after beach season.
    const issued = j.issuanceTime ? new Date(j.issuanceTime) : null;
    const dayKey = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", dateStyle: "short" }).format(d);
    if (!issued || dayKey(issued) !== dayKey(new Date())) return null;

    const text = j.productText ?? "";
    const start = text.indexOf("NCZ106-");
    if (start < 0) return null;
    const end = text.indexOf("$$", start);
    const block = text.slice(start, end < 0 ? undefined : end);
    const periods = block
      .split(/^\./m)
      .slice(1)
      .map((chunk) => {
        const i = chunk.indexOf("...");
        return { name: chunk.slice(0, i), body: chunk.slice(i + 3) };
      })
      .filter((p) => p.name && p.name.trim() !== "EXTENDED");
    const [first, second] = periods;
    if (!first) return null;
    const rip = ripOf(first.body.match(/Rip Current Risk\*?\.*\s*(\w+)/i)?.[1]);
    if (!rip) return null;
    const line = (label: string) =>
      first.body.match(new RegExp(`${label}\\.*\\s*([^\\n]+?)\\.\\s*$`, "im"))?.[1]?.trim() ?? null;
    const nextRip = second
      ? ripOf(second.body.match(/Rip Current Risk\*?\.*\s*(\w+)/i)?.[1] ?? second.body.match(/(\w+) rip current risk/i)?.[1])
      : null;
    return {
      rip,
      surf: line("Surf Height"),
      water: line("Water Temperature")?.replace(/^in the\s+/i, "") ?? null,
      next: second && nextRip ? { label: periodName(second.name), rip: nextRip } : null,
    };
  } catch {
    return null;
  }
}

const NHC_KIND: Record<string, string> = {
  HU: "Hurricane",
  TS: "Tropical Storm",
  TD: "Tropical Depression",
  STS: "Subtropical Storm",
  SD: "Subtropical Depression",
  PTC: "Potential Tropical Cyclone",
};

function milesFromBridge(lat: number, lng: number): number {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const [lat1, lng1] = [34.43 * rad, -77.55 * rad];
  const dLat = lat * rad - lat1;
  const dLng = lng * rad - lng1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Atlantic storms within ~600 miles: early enough to matter, far enough out
// that a Gulf storm heading for Texas doesn't put a banner on the island.
async function getStorms(): Promise<StormWatch[]> {
  try {
    const r = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      activeStorms?: {
        id: string;
        name: string;
        classification: string;
        latitudeNumeric: number;
        longitudeNumeric: number;
        publicAdvisory?: { url?: string };
      }[];
    };
    return (j.activeStorms ?? [])
      .filter((s) => s.id.startsWith("al"))
      .map((s) => ({
        name: s.name,
        kind: NHC_KIND[s.classification] ?? "Storm",
        miles: Math.round(milesFromBridge(s.latitudeNumeric, s.longitudeNumeric)),
        url: s.publicAdvisory?.url ?? "https://www.nhc.noaa.gov/",
      }))
      .filter((s) => s.miles <= 600)
      .sort((a, b) => a.miles - b.miles);
  } catch {
    return [];
  }
}

export async function GET() {
  const [dnc, ws, tides, alerts, beach, storms] = await Promise.all([
    driveNCIncidents(),
    getWeatherSun(),
    getTides(),
    getAlerts(),
    getBeach(),
    getStorms(),
  ]);
  const all = dnc ?? (await wzdxIncidents());
  const incidents = (all ?? []).slice(0, 8);
  const omitted = Math.max(0, (all?.length ?? 0) - incidents.length);
  // Both incident feeds down: tell the UI, and don't hold the gap for long.
  const incidentsDown = all == null;
  return NextResponse.json(
    {
      incidents,
      omitted,
      weather: ws.weather,
      sun: ws.sun,
      tides,
      alerts,
      beach,
      storms,
      incidentsDown,
      source: dnc ? "drivenc" : "wzdx",
    },
    {
      headers: {
        // A closure alert shouldn't sit behind a 15-minute-old cache entry.
        "Cache-Control": incidentsDown
          ? "public, s-maxage=60"
          : "public, s-maxage=300, stale-while-revalidate=120",
      },
    },
  );
}
