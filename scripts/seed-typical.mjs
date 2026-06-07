// One-time seed: builds a "typical week" baseline by asking Mapbox for its
// predicted (depart_at) drive time for every hour of the next 7 days, one of
// each weekday. Writes src/data/typical.json so the heatmap has full coverage
// immediately; the live cron (poll.mjs) then sharpens cells with real data.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
if (!TOKEN) {
  console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
  process.exit(1);
}

const O = { lng: -77.60552, lat: 34.38541 }; // 718 N Anderson Blvd, Topsail Beach
const D = { lng: -77.605212, lat: 34.450868 };
const TZ = "America/New_York";
const coords = `${O.lng},${O.lat};${D.lng},${D.lat}`;
const HOURS = [];
for (let h = 6; h <= 21; h++) HOURS.push(h);
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function nyParts(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const p = {};
  for (const x of fmt.formatToParts(date)) if (x.type !== "literal") p[x.type] = x.value;
  return p;
}

async function predict(departStr) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}&depart_at=${encodeURIComponent(departStr)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const route = (await r.json())?.routes?.[0];
  return route ? Math.round(route.duration / 60) : null;
}

const start = new Date();
const tasks = [];
// Days 1..7 from now = the next occurrence of each weekday, all in the future.
for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
  const d = new Date(start.getTime() + dayOffset * 86_400_000);
  const p = nyParts(d);
  const dow = DOW[p.weekday];
  for (const h of HOURS) {
    const departStr = `${p.year}-${p.month}-${p.day}T${String(h).padStart(2, "0")}:00`;
    tasks.push({ dow, h, departStr });
  }
}

const grid = {};
for (let dow = 0; dow < 7; dow++) grid[dow] = {};

// Run in small batches to stay polite to the API.
const BATCH = 8;
for (let i = 0; i < tasks.length; i += BATCH) {
  const slice = tasks.slice(i, i + BATCH);
  const results = await Promise.all(slice.map((t) => predict(t.departStr)));
  slice.forEach((t, j) => {
    if (results[j] != null) grid[t.dow][t.h] = results[j];
  });
  console.log(`  ${Math.min(i + BATCH, tasks.length)}/${tasks.length}`);
}

const out = {
  generatedAt: start.toISOString(),
  tz: TZ,
  route: { origin: O, dest: D, label: "Topsail Beach → Harris Teeter (Hampstead)" },
  hours: HOURS,
  grid,
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "typical.json"), JSON.stringify(out, null, 2));
console.log("wrote src/data/typical.json");
