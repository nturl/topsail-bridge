import type { Forecast, ForecastPoint, LngLat } from "./types";

const TZ = "America/New_York";
const TOKEN = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function nyParts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return p;
}

// "YYYY-MM-DDThh:mm" in Eastern time, the format Mapbox depart_at expects
// (no timezone suffix => Mapbox assumes local to the route's start point).
export function nyDepartAt(date: Date): string {
  const p = nyParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function nyClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// A guaranteed off-peak time (tomorrow 5am, local) to anchor a free-flow baseline.
function freeFlowDepartAt(): string {
  const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const p = nyParts(t);
  return `${p.year}-${p.month}-${p.day}T05:00`;
}

// One traffic-aware route lookup. departAt omitted => live conditions.
export async function routeDuration(
  o: LngLat,
  d: LngLat,
  departAt?: string,
): Promise<{ minutes: number; distanceMi: number } | null> {
  if (!TOKEN) return null;
  const coords = `${o.lng},${o.lat};${d.lng},${d.lat}`;
  let url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}`;
  if (departAt) url += `&depart_at=${encodeURIComponent(departAt)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  const route = j?.routes?.[0];
  if (!route) return null;
  return { minutes: route.duration / 60, distanceMi: route.distance / 1609.34 };
}

// Live "now" plus a predicted curve across the next few hours.
export async function buildForecast(
  o: LngLat,
  d: LngLat,
  horizonMin = 180,
  stepMin = 15,
): Promise<Forecast> {
  const start = new Date();
  const offsets: number[] = [];
  for (let m = 0; m <= horizonMin; m += stepMin) offsets.push(m);

  // Kick off the free-flow probe in parallel with the forecast points.
  const freeFlowPromise = routeDuration(o, d, freeFlowDepartAt());

  const raw = await Promise.all(
    offsets.map(async (off) => {
      const when = new Date(start.getTime() + off * 60_000);
      const res = await routeDuration(o, d, off === 0 ? undefined : nyDepartAt(when));
      return {
        offsetMin: off,
        at: when.toISOString(),
        clock: nyClock(when),
        minutes: res ? Math.round(res.minutes) : null,
        distanceMi: res?.distanceMi ?? null,
      };
    }),
  );

  const points: ForecastPoint[] = raw.map((p) => ({
    offsetMin: p.offsetMin,
    at: p.at,
    clock: p.clock,
    minutes: p.minutes,
  }));

  const valid = points.filter(
    (p): p is ForecastPoint & { minutes: number } => p.minutes != null,
  );
  const best = valid.length
    ? valid.reduce((a, b) => (b.minutes < a.minutes ? b : a))
    : null;
  const worst = valid.length
    ? valid.reduce((a, b) => (b.minutes > a.minutes ? b : a))
    : null;

  const freeFlowRes = await freeFlowPromise;
  const freeFlow = freeFlowRes ? Math.round(freeFlowRes.minutes) : null;

  return {
    generatedAt: start.toISOString(),
    origin: o,
    dest: d,
    distanceMi: raw[0]?.distanceMi ?? null,
    now: points[0]?.minutes ?? null,
    freeFlow,
    points,
    best,
    worst,
  };
}
