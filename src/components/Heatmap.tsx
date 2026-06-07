"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type Cell = {
  dow: number;
  hod: number;
  minutes: number;
  source: "actual" | "typical";
  samples: number;
};
type History = { hours: number[]; cells: Cell[]; totalActual: number };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function heatColor(t: number): string {
  const hue = 145 - 145 * Math.max(0, Math.min(1, t)); // green -> red
  return `hsl(${hue}, 68%, 46%)`;
}

function hourLabel(h: number): string {
  const ap = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

function nowCell(): { dow: number; hod: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const wd = p.find((x) => x.type === "weekday")?.value ?? "Sun";
  const hod = Number(p.find((x) => x.type === "hour")?.value ?? "0");
  return { dow: DAYS.indexOf(wd), hod };
}

export function Heatmap() {
  const [data, setData] = useState<History | null>(null);
  const [sel, setSel] = useState<Cell | null>(null);
  const now = useMemo(nowCell, []);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const { byKey, min, max } = useMemo(() => {
    const m = new Map<string, Cell>();
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of data?.cells ?? []) {
      m.set(`${c.dow}:${c.hod}`, c);
      if (c.minutes < lo) lo = c.minutes;
      if (c.minutes > hi) hi = c.minutes;
    }
    return { byKey: m, min: lo, max: hi };
  }, [data]);

  if (!data || !data.cells.length) return null;
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Weekly rhythm</h2>
        <span className="text-xs text-slate-400">leaving the island</span>
      </div>

      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "1.7rem repeat(7, minmax(0, 1fr))" }}>
        <div />
        {DAYS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] ${
              i === now.dow ? "font-semibold text-sky-600 dark:text-sky-400" : "text-slate-400"
            }`}
          >
            {d}
          </div>
        ))}
        {data.hours.map((h) => (
          <Fragment key={h}>
            <div className="flex items-center justify-end pr-1 text-[10px] text-slate-400">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </div>
            {DAYS.map((_, dow) => {
              const c = byKey.get(`${dow}:${h}`);
              const isNow = dow === now.dow && h === now.hod;
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => c && setSel(c)}
                  className={`h-4 rounded-[3px] transition ${
                    isNow ? "ring-2 ring-slate-900 dark:ring-white" : ""
                  }`}
                  style={{
                    background: c ? heatColor(norm(c.minutes)) : "transparent",
                    opacity: c ? (c.source === "actual" ? 1 : 0.55) : 0.15,
                  }}
                  aria-label={c ? `${DAYS[dow]} ${hourLabel(h)}: ${c.minutes} minutes` : undefined}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="text-slate-600 dark:text-slate-300">
          {sel ? (
            <span>
              <span className="font-medium">
                {DAYS[sel.dow]} {hourLabel(sel.hod)}
              </span>{" "}
              · {sel.minutes} min{" "}
              <span className="text-slate-400">
                ({sel.source === "actual" ? `${sel.samples} reading${sel.samples === 1 ? "" : "s"}` : "predicted"})
              </span>
            </span>
          ) : (
            <span className="text-slate-400">Tap a cell for detail</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>faster</span>
          <span
            className="h-2 w-14 rounded-full"
            style={{ background: "linear-gradient(90deg, hsl(145,68%,46%), hsl(72,68%,46%), hsl(0,68%,46%))" }}
          />
          <span>slower</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Dimmed cells are Mapbox predictions; solid cells are measured. {data.totalActual} live reading
        {data.totalActual === 1 ? "" : "s"} logged so far — the grid sharpens as more come in.
      </p>
    </div>
  );
}
