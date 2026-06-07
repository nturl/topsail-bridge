// One-time seed: builds a "typical week" baseline for BOTH directions
// (leaving the island and coming back) from Mapbox depart_at predictions, so
// the heatmap has full coverage immediately. The live cron sharpens it.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
if (!TOKEN) {
  console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
  process.exit(1);
}

const O = { lng: -77.60552, lat: 34.38541 }; // 718 N Anderson Blvd, Topsail Beach
const D = { lng: -77.605212, lat: 34.450868 }; // Harris Teeter, Hampstead
const TZ = "America/New_York";
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

async function predict(coords, departStr) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${TOKEN}&depart_at=${encodeURIComponent(departStr)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const route = (await r.json())?.routes?.[0];
  return route ? Math.round(route.duration / 60) : null;
}

const start = new Date();
const tasks = [];
for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
  const d = new Date(start.getTime() + dayOffset * 86_400_000);
  const p = nyParts(d);
  const dow = DOW[p.weekday];
  for (const h of HOURS) {
    tasks.push({ dow, h, departStr: `${p.year}-${p.month}-${p.day}T${String(h).padStart(2, "0")}:00` });
  }
}

const OUT = `${O.lng},${O.lat};${D.lng},${D.lat}`;
const BACK = `${D.lng},${D.lat};${O.lng},${O.lat}`;
const out = {};
const back = {};
for (let dow = 0; dow < 7; dow++) {
  out[dow] = {};
  back[dow] = {};
}

const BATCH = 8;
for (let i = 0; i < tasks.length; i += BATCH) {
  const slice = tasks.slice(i, i + BATCH);
  const results = await Promise.all(
    slice.flatMap((t) => [predict(OUT, t.departStr), predict(BACK, t.departStr)]),
  );
  slice.forEach((t, j) => {
    const o = results[j * 2];
    const b = results[j * 2 + 1];
    if (o != null) out[t.dow][t.h] = o;
    if (b != null) back[t.dow][t.h] = b;
  });
  console.log(`  ${Math.min(i + BATCH, tasks.length)}/${tasks.length}`);
}

const data = {
  generatedAt: start.toISOString(),
  tz: TZ,
  route: { origin: O, dest: D, label: "Topsail Beach to Harris Teeter (Hampstead)" },
  hours: HOURS,
  out,
  back,
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "typical.json"), JSON.stringify(data, null, 2));
console.log("wrote src/data/typical.json (both directions)");
