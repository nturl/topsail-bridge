// Cron logger: records one live traffic-aware reading in each direction
// (leaving the island and coming back) and appends them to data/log.ndjson.
// Dependency-free (Node 20+ global fetch) so the GitHub Action needs no install.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!TOKEN) {
  console.error("Missing MAPBOX_TOKEN");
  process.exit(1);
}

// Canonical route. Keep in sync with src/lib/places.ts (DEFAULT_ORIGIN/DEST).
const O = { lng: -77.545585, lat: 34.427278 }; // Surf City (canonical default)
const D = { lng: -77.605212, lat: 34.450868 }; // Harris Teeter, Hampstead
const TZ = "America/New_York";

async function measure(coords) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const route = (await r.json())?.routes?.[0];
  return route ? { min: Math.round(route.duration / 60), mi: Math.round((route.distance / 1609.34) * 10) / 10 } : null;
}

const now = new Date();
const out = await measure(`${O.lng},${O.lat};${D.lng},${D.lat}`);
const back = await measure(`${D.lng},${D.lat};${O.lng},${O.lat}`);
if (!out && !back) {
  console.error("No routes returned");
  process.exit(1);
}

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
}).formatToParts(now);
const weekday = parts.find((p) => p.type === "weekday").value;
const hod = Number(parts.find((p) => p.type === "hour").value);
const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday];

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDir, { recursive: true });
const logPath = join(dataDir, "log.ndjson");

for (const [dir, m] of [["out", out], ["back", back]]) {
  if (!m) continue;
  const rec = { at: now.toISOString(), dir, dow, hod, min: m.min, mi: m.mi };
  appendFileSync(logPath, JSON.stringify(rec) + "\n");
  console.log("logged", JSON.stringify(rec));
}
