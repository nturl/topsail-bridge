// Cron logger: records one live traffic-aware reading of the canonical
// "leaving the island" route and appends it to data/log.ndjson.
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
const O = { lng: -77.60552, lat: 34.38541 }; // 718 N Anderson Blvd, Topsail Beach
const D = { lng: -77.605212, lat: 34.450868 }; // Harris Teeter, Hampstead
const TZ = "America/New_York";

const now = new Date();
const coords = `${O.lng},${O.lat};${D.lng},${D.lat}`;
const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}`;

const r = await fetch(url);
if (!r.ok) {
  console.error("Mapbox error", r.status);
  process.exit(1);
}
const route = (await r.json())?.routes?.[0];
if (!route) {
  console.error("No route returned");
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

const rec = {
  at: now.toISOString(),
  dow,
  hod,
  min: Math.round(route.duration / 60),
  mi: Math.round((route.distance / 1609.34) * 10) / 10,
};

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDir, { recursive: true });
appendFileSync(join(dataDir, "log.ndjson"), JSON.stringify(rec) + "\n");
console.log("logged", JSON.stringify(rec));
