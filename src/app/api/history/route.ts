import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import bundled from "@/data/typical.json";
import { DEFAULT_ORIGIN, DEFAULT_DEST, canonicalDir } from "@/lib/places";
import { generateTypical } from "@/lib/mapbox";
import { inServiceArea, quantizePoint } from "@/lib/geo";
import type { LngLat } from "@/lib/types";

const RAW = "https://raw.githubusercontent.com/nturl/topsail-bridge/main/data/log.ndjson";

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

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

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
  if (!inServiceArea(o) || !inServiceArea(d)) return new NextResponse(null, { status: 400 });
  const canon = canonicalDir(o, d);

  const hours = bundled.hours as number[];
  let grid: Record<string, Record<string, number>>;
  const actuals = new Map<string, number[]>();
  let totalActual = 0;

  if (canon) {
    grid = (bundled as Record<string, unknown>)[canon] as Record<string, Record<string, number>>;
    try {
      const r = await fetch(RAW, { next: { revalidate: 600 } });
      if (r.ok) {
        const text = await r.text();
        for (const line of text.split("\n")) {
          const t = line.trim();
          if (!t) continue;
          try {
            const rec = JSON.parse(t);
            const rd = rec.dir === "back" ? "back" : "out";
            if (rd !== canon) continue;
            if (typeof rec.dow === "number" && typeof rec.hod === "number" && typeof rec.min === "number") {
              const k = `${rec.dow}:${rec.hod}`;
              const arr = actuals.get(k) ?? [];
              arr.push(rec.min);
              actuals.set(k, arr);
              totalActual++;
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* raw unavailable */
    }
  } else {
    grid = await cachedTypical(o.lng, o.lat, d.lng, d.lat);
  }

  const cells: Cell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (const hod of hours) {
      const act = actuals.get(`${dow}:${hod}`);
      if (act && act.length) {
        cells.push({ dow, hod, minutes: median(act), source: "actual", samples: act.length });
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
