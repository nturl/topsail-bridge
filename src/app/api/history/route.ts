import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import bundled from "@/data/typical.json";
import bundledMeasured from "@/data/measured.json";
import { DEFAULT_ORIGIN, DEFAULT_DEST, canonicalDir } from "@/lib/places";
import { generateTypical } from "@/lib/mapbox";
import { inServiceArea, quantizePoint } from "@/lib/geo";
import type { LngLat } from "@/lib/types";

const MEASURED_RAW = "https://raw.githubusercontent.com/nturl/topsail-bridge/main/src/data/measured.json";

type Measured = Record<"out" | "back", Record<string, Record<string, { min: number; n: number }>>>;

type Cell = {
  dow: number;
  hod: number;
  minutes: number;
  source: "actual" | "typical";
  samples: number;
};

// Predicted typical week for an arbitrary route, cached a week in Vercel's
// Data Cache so each unique route is only generated once.
const cachedTypical = unstable_cache(
  async (oLng: number, oLat: number, dLng: number, dLat: number) =>
    generateTypical({ lng: oLng, lat: oLat }, { lng: dLng, lat: dLat }),
  ["typical-route-v1"],
  { revalidate: 604_800 },
);

function parse(s: string | null, fallback: LngLat): LngLat {
  if (s) {
    const [lng, lat] = s.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return quantizePoint({ lng, lat });
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const o = parse(sp.get("o"), DEFAULT_ORIGIN);
  const d = parse(sp.get("d"), DEFAULT_DEST);
  // Non-canonical routes trigger a 42-call Mapbox generation; bound who can ask.
  if (!inServiceArea(o) || !inServiceArea(d))
    return new NextResponse(null, { status: 400, headers: { "Cache-Control": "public, s-maxage=3600" } });
  const canon = canonicalDir(o, d);

  const hours = bundled.hours as number[];
  let grid: Record<string, Record<string, number>>;
  const actuals = new Map<string, { min: number; n: number }>();
  let totalActual = 0;

  if (canon) {
    grid = (bundled as Record<string, unknown>)[canon] as Record<string, Record<string, number>>;
    // The cron folds every reading into measured.json (per-hour medians and
    // counts, ~20 KB); read that live from GitHub so new readings show up
    // without a redeploy, falling back to the copy bundled at build time.
    let measured: Measured = bundledMeasured as Measured;
    try {
      const r = await fetch(MEASURED_RAW, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
      if (r.ok) measured = (await r.json()) as Measured;
    } catch {
      /* raw unavailable: bundled copy */
    }
    for (const [dow, hours] of Object.entries(measured[canon] ?? {})) {
      for (const [hod, cell] of Object.entries(hours)) {
        actuals.set(`${dow}:${hod}`, cell);
        totalActual += cell.n;
      }
    }
  } else {
    // A typical week is a coarse rhythm, so snap both ends to ~1 km: nearby
    // houses share one generation, and the paid key space stays small.
    const snap = (v: number) => Math.round(v * 100) / 100;
    try {
      grid = await cachedTypical(snap(o.lng), snap(o.lat), snap(d.lng), snap(d.lat));
    } catch {
      // Generation came back too thin to trust (see generateTypical); retry later.
      return NextResponse.json(
        { canonical: false, hours, cells: [], totalActual: 0 },
        { headers: { "Cache-Control": "public, s-maxage=300" } },
      );
    }
  }

  const cells: Cell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (const hod of hours) {
      const act = actuals.get(`${dow}:${hod}`);
      if (act && act.n > 0) {
        cells.push({ dow, hod, minutes: act.min, source: "actual", samples: act.n });
      } else {
        const typ = grid?.[String(dow)]?.[String(hod)];
        if (typ != null) cells.push({ dow, hod, minutes: typ, source: "typical", samples: 0 });
      }
    }
  }

  return NextResponse.json(
    { canonical: !!canon, hours, cells, totalActual },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
  );
}
