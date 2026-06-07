import { NextRequest, NextResponse } from "next/server";
import typical from "@/data/typical.json";

// Actuals are committed by the cron to main; read them fresh (not bundled).
const RAW = "https://raw.githubusercontent.com/nturl/topsail-bridge/main/data/log.ndjson";

type Dir = "out" | "back";
type Cell = {
  dow: number;
  hod: number;
  minutes: number;
  source: "actual" | "typical";
  samples: number;
};

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export async function GET(req: NextRequest) {
  const dir: Dir = req.nextUrl.searchParams.get("dir") === "back" ? "back" : "out";

  const actuals = new Map<string, number[]>();
  let totalActual = 0;
  try {
    const r = await fetch(RAW, { next: { revalidate: 600 } });
    if (r.ok) {
      const text = await r.text();
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const rec = JSON.parse(t);
          const recDir: Dir = rec.dir === "back" ? "back" : "out"; // legacy rows = out
          if (recDir !== dir) continue;
          if (typeof rec.dow === "number" && typeof rec.hod === "number" && typeof rec.min === "number") {
            const k = `${rec.dow}:${rec.hod}`;
            const arr = actuals.get(k) ?? [];
            arr.push(rec.min);
            actuals.set(k, arr);
            totalActual++;
          }
        } catch {
          /* skip malformed line */
        }
      }
    }
  } catch {
    /* raw log not available yet; fall back to typical */
  }

  const hours = typical.hours as number[];
  const grid = (typical as Record<string, unknown>)[dir] as Record<string, Record<string, number>>;
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
    { dir, hours, cells, totalActual, generatedAt: typical.generatedAt, route: typical.route },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
  );
}
