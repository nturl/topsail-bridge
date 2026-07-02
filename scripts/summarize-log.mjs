// Distills data/log.ndjson (the cron's live readings on the canonical
// Surf City <-> Hampstead route) into src/data/measured.json: median minutes
// per day-of-week x hour, both directions, plus sample metadata. The
// /best-time-to-leave page renders from this at build time. Dependency-free.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(join(root, "data", "log.ndjson"), "utf8").split("\n");

const byCell = { out: new Map(), back: new Map() };
let n = 0;
let firstAt = null;
let lastAt = null;

for (const line of lines) {
  const t = line.trim();
  if (!t) continue;
  let rec;
  try {
    rec = JSON.parse(t);
  } catch {
    continue;
  }
  const dir = rec.dir === "back" ? "back" : "out";
  if (typeof rec.dow !== "number" || typeof rec.hod !== "number" || typeof rec.min !== "number") continue;
  const key = `${rec.dow}:${rec.hod}`;
  const arr = byCell[dir].get(key) ?? [];
  arr.push(rec.min);
  byCell[dir].set(key, arr);
  n++;
  if (!firstAt || rec.at < firstAt) firstAt = rec.at;
  if (!lastAt || rec.at > lastAt) lastAt = rec.at;
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const out = {};
const back = {};
for (let dow = 0; dow < 7; dow++) {
  out[dow] = {};
  back[dow] = {};
}
for (const [dir, grid] of [
  ["out", out],
  ["back", back],
]) {
  for (const [key, vals] of byCell[dir]) {
    const [dow, hod] = key.split(":");
    grid[dow][hod] = { min: median(vals), n: vals.length };
  }
}

const data = {
  generatedAt: new Date().toISOString(),
  samples: n,
  firstAt,
  lastAt,
  route: "Surf City <-> Harris Teeter (Hampstead), across the Surf City bridge",
  out,
  back,
};

mkdirSync(join(root, "src", "data"), { recursive: true });
writeFileSync(join(root, "src", "data", "measured.json"), JSON.stringify(data, null, 2));
console.log(`wrote src/data/measured.json (${n} readings, ${firstAt} .. ${lastAt})`);
