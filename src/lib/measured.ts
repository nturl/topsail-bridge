import bundledMeasured from "@/data/measured.json";
import { hourLabel } from "@/lib/heat";

// Per-hour medians of every logged crossing, by direction, day of week and hour.
export type Grid = Record<string, Record<string, { min: number; n: number }>>;
export type Measured = { samples: number; firstAt: string; lastAt: string; out: Grid; back: Grid };

export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6a..9p
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MEASURED_RAW = "https://raw.githubusercontent.com/nturl/topsail-bridge/main/src/data/measured.json";

// The poll workflow refreshes measured.json in the repo through the day, but
// this site only redeploys by hand. Read it live (hourly) so pages keep up,
// and fall back to the copy bundled at build time.
export async function loadMeasured(): Promise<Measured> {
  try {
    const r = await fetch(MEASURED_RAW, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (r.ok) return (await r.json()) as Measured;
  } catch {
    /* fall through */
  }
  return bundledMeasured as Measured;
}

export function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Off-peak baseline: everything before 9am and from 6pm on, across both directions.
export function baseline(measured: Measured): number {
  const vals: number[] = [];
  for (const grid of [measured.out, measured.back]) {
    for (let d = 0; d < 7; d++) for (const h of HOURS) {
      if (h >= 9 && h < 18) continue;
      const c = grid[String(d)]?.[String(h)];
      if (c) vals.push(c.min);
    }
  }
  return median(vals);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }): string {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: "America/New_York" });
}

// One plain sentence set for the home page's server HTML: the usual crossing,
// the slowest measured hour of the week, and how much data is behind it.
export function typicalSummary(measured: Measured): string {
  let worst = { min: 0, dow: 0, hod: 0, dir: "out" as "out" | "back" };
  for (const dir of ["out", "back"] as const) {
    for (let d = 0; d < 7; d++) for (const h of HOURS) {
      const c = measured[dir][String(d)]?.[String(h)];
      if (c && c.min > worst.min) worst = { min: c.min, dow: d, hod: h, dir };
    }
  }
  const base = baseline(measured);
  const slow =
    worst.min > base
      ? ` The slowest hour we've measured is ${DAY_NAMES[worst.dow]} around ${hourLabel(worst.hod)} (${worst.min} min ${
          worst.dir === "out" ? "leaving the island" : "heading to the island"
        }).`
      : "";
  return `The usual crossing is ${base} minutes.${slow} ${measured.samples.toLocaleString("en-US")} readings since ${fmtDate(
    measured.firstAt,
    { month: "long", day: "numeric" },
  )}.`;
}
