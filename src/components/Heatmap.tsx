"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { HistoryCell, HistoryData } from "@/lib/types";
import { heatColor, heatFill, heatScale, hourLabel } from "@/lib/heat";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

// Answer-first line: the worst stretch of the week against the quickest hour
// that same day, or a plain "steady" when the whole week barely moves.
function weekSummary(cells: HistoryCell[], hours: number[]): { lead: string; rest: string } {
  const lo = Math.min(...cells.map((c) => c.minutes));
  const hi = Math.max(...cells.map((c) => c.minutes));
  if (hi - lo < 4)
    return { lead: "Steady all week.", rest: ` ${lo} to ${hi} min any day, any hour.` };

  const at = new Map(cells.map((c) => [`${c.dow}:${c.hod}`, c.minutes]));
  // Grow a run of hours around each worst cell while traffic stays within 2
  // min of the peak; keep the longest run (earliest on ties).
  let run = { dow: 0, from: 0, to: 0 };
  for (const c of cells) {
    if (c.minutes !== hi) continue;
    const i = hours.indexOf(c.hod);
    let a = i;
    let b = i;
    while (a > 0 && (at.get(`${c.dow}:${hours[a - 1]}`) ?? 0) >= hi - 2) a--;
    while (b < hours.length - 1 && (at.get(`${c.dow}:${hours[b + 1]}`) ?? 0) >= hi - 2) b++;
    if (b - a > run.to - run.from || run.to === 0) run = { dow: c.dow, from: hours[a], to: hours[b] };
  }
  const span =
    run.from === run.to ? `around ${hourLabel(run.from)}` : `${hourLabel(run.from)}-${hourLabel(run.to + 1)}`;

  // Quickest hour that day, nearest to the bad stretch.
  const sameDay = cells.filter((c) => c.dow === run.dow);
  const dayMin = Math.min(...sameDay.map((c) => c.minutes));
  const best = sameDay
    .filter((c) => c.minutes === dayMin)
    .reduce((a, b) => (Math.abs(b.hod - run.from) < Math.abs(a.hod - run.from) ? b : a));
  return {
    lead: `${DAY_NAMES[run.dow]} ${span} is the worst crossing of the week:`,
    rest: ` ${hi} min vs ${dayMin} min at ${hourLabel(best.hod)}.`,
  };
}

export function Heatmap({ data, dir }: { data: HistoryData | null; dir: "out" | "back" }) {
  const [sel, setSel] = useState<HistoryCell | null>(null);
  const now = useMemo(nowCell, []);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSel(null), [data]);

  const { byKey, scale } = useMemo(() => {
    const m = new Map<string, HistoryCell>();
    const vals: number[] = [];
    for (const c of data?.cells ?? []) {
      m.set(`${c.dow}:${c.hod}`, c);
      vals.push(c.minutes);
    }
    return { byKey: m, scale: heatScale(vals) };
  }, [data]);

  const subtext = dir === "out" ? "leaving the island" : "coming back";
  const header = (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        Weekly rhythm
      </h2>
      <span className="text-xs text-slate-500 dark:text-slate-400">{subtext}</span>
    </div>
  );

  if (!data) {
    return (
      <div>
        {header}
        <div className="flex h-44 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 motion-safe:animate-pulse dark:bg-slate-800 dark:text-slate-400">
          Building this route&apos;s weekly pattern…
        </div>
      </div>
    );
  }
  if (!data.cells.length) return null;

  const summary = weekSummary(data.cells, data.hours);
  const hours = data.hours;

  // One tab stop for the whole grid; arrow keys move between cells.
  const focusKey = sel ? `${sel.dow}:${sel.hod}` : byKey.has(`${now.dow}:${now.hod}`) ? `${now.dow}:${now.hod}` : `${data.cells[0].dow}:${data.cells[0].hod}`;
  const onKey = (e: KeyboardEvent) => {
    const [dow, hod] = focusKey.split(":").map(Number);
    const hi = hours.indexOf(hod);
    let nd = dow;
    let nh = hi;
    if (e.key === "ArrowRight") nd = Math.min(6, dow + 1);
    else if (e.key === "ArrowLeft") nd = Math.max(0, dow - 1);
    else if (e.key === "ArrowDown") nh = Math.min(hours.length - 1, hi + 1);
    else if (e.key === "ArrowUp") nh = Math.max(0, hi - 1);
    else return;
    e.preventDefault();
    const c = byKey.get(`${nd}:${hours[nh]}`);
    if (!c) return;
    setSel(c);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-k="${nd}:${hours[nh]}"]`)?.focus();
  };

  // Best hour on the selected cell's day, for the "+N vs 7a" readout.
  const selBest = sel
    ? data.cells.filter((c) => c.dow === sel.dow).reduce((a, b) => (b.minutes < a.minutes ? b : a))
    : null;

  return (
    <div>
      {header}

      <p className="text-[15px] leading-snug text-slate-900 dark:text-white">
        <span className="font-semibold">{summary.lead}</span>
        <span className="text-slate-600 dark:text-slate-300">{summary.rest}</span>
      </p>

      {/* Legend sits above the grid so the key is read first */}
      <div className="mt-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums">{scale.lo} min</span>
          <span
            aria-hidden
            className="h-2 w-12 rounded-full"
            style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }}
          />
          <span className="tabular-nums">{scale.hi}+ min</span>
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: heatFill(0.4, false) }} />
          Measured
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: heatFill(0.4, true) }} />
          Predicted
        </span>
      </div>

      <div
        ref={gridRef}
        role="group"
        aria-label={`Typical drive time by day and hour. ${summary.lead}${summary.rest} Use arrow keys to move between hours.`}
        onKeyDown={onKey}
        className="relative grid gap-[3px]"
        style={{ gridTemplateColumns: "1.9rem repeat(7, minmax(0, 1fr))" }}
      >
        {/* Today's column, tinted behind the cells */}
        <div
          aria-hidden
          className="-mx-[2px] -my-[2px] rounded-md bg-sky-100 dark:bg-sky-900/50"
          style={{ gridColumn: now.dow + 2, gridRow: `1 / ${hours.length + 2}` }}
        />
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={`relative flex h-6 flex-col items-center justify-center text-[11px] leading-none ${
              i === now.dow ? "font-semibold text-sky-800 dark:text-sky-200" : "text-slate-500 dark:text-slate-400"
            }`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {i === now.dow ? "Today" : day}
            {(i === 0 || i === 6) && (
              <span aria-hidden className="mt-0.5 h-1 w-1 rounded-full bg-amber-500" title="Turnover day" />
            )}
          </div>
        ))}
        {hours.map((h, r) => (
          <div
            key={`l${h}`}
            className="flex items-center justify-end pr-1 text-[11px] leading-none text-slate-500 dark:text-slate-400"
            style={{ gridColumn: 1, gridRow: r + 2 }}
          >
            {h % 2 === 0 ? hourLabel(h) : ""}
          </div>
        ))}
        {hours.map((h, r) =>
          DAYS.map((_, dow) => {
            const k = `${dow}:${h}`;
            const c = byKey.get(k);
            const isNow = dow === now.dow && h === now.hod;
            const isSel = !!sel && sel.dow === dow && sel.hod === h;
            const pos = { gridColumn: dow + 2, gridRow: r + 2 };
            if (!c) return <div key={k} aria-hidden className="h-5 rounded-[3px] bg-slate-100 dark:bg-slate-800" style={pos} />;
            return (
              <button
                key={k}
                data-k={k}
                type="button"
                tabIndex={k === focusKey ? 0 : -1}
                aria-pressed={isSel}
                aria-label={`${DAY_NAMES[dow]} ${hourLabel(h)}: ${c.minutes} minutes, ${c.source === "actual" ? "measured" : "predicted"}${isNow ? ", now" : ""}`}
                onClick={() => setSel(isSel ? null : c)}
                className={`relative h-5 rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600 ${
                  isSel
                    ? "ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-900"
                    : isNow
                      ? "ring-2 ring-sky-600 dark:ring-sky-300"
                      : ""
                }`}
                style={{ ...pos, background: heatFill(scale.norm(c.minutes), c.source !== "actual") }}
              />
            );
          }),
        )}
      </div>

      {/* Tap readout */}
      <p className="mt-3 min-h-4 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {sel && selBest ? (
          <>
            <span className="font-medium">
              {DAYS[sel.dow]} {hourLabel(sel.hod)}: {sel.minutes} min
            </span>
            {sel.minutes > selBest.minutes ? (
              <>
                ,{" "}
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  +{sel.minutes - selBest.minutes} vs {hourLabel(selBest.hod)}
                </span>
              </>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">, as quick as {DAYS[sel.dow]} gets</span>
            )}
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              ({sel.source === "actual" ? `${sel.samples} reading${sel.samples === 1 ? "" : "s"}` : "predicted, no readings yet"})
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">Tap any hour to compare it with that day&apos;s best.</span>
        )}
      </p>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {data.canonical
          ? `Based on ${data.totalActual.toLocaleString("en-US")} live readings. Times are medians for each hour.`
          : "Predicted from Mapbox traffic patterns for your route."}
      </p>
    </div>
  );
}
