"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { HistoryCell, HistoryData } from "@/lib/types";
import { heatColor, heatScale, hourLabel } from "@/lib/heat";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function Heatmap({ data, dir }: { data: HistoryData | null; dir: "out" | "back" }) {
  const [sel, setSel] = useState<HistoryCell | null>(null);
  const now = useMemo(nowCell, []);

  useEffect(() => setSel(null), [data]);

  const { byKey, norm } = useMemo(() => {
    const m = new Map<string, HistoryCell>();
    const vals: number[] = [];
    for (const c of data?.cells ?? []) {
      m.set(`${c.dow}:${c.hod}`, c);
      vals.push(c.minutes);
    }
    return { byKey: m, norm: heatScale(vals).norm };
  }, [data]);

  const subtext = dir === "out" ? "leaving the island" : "coming back";

  if (!data) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Weekly rhythm</h2>
          <span className="text-xs text-slate-400">{subtext}</span>
        </div>
        <div className="flex h-44 animate-pulse items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">
          Building this route&apos;s weekly pattern…
        </div>
      </div>
    );
  }
  if (!data.cells.length) return null;

  const todayCells = data.cells.filter((c) => c.dow === now.dow);
  const bestToday = todayCells.length ? todayCells.reduce((a, b) => (b.minutes < a.minutes ? b : a)) : null;
  const busiest = data.cells.reduce((a, b) => (b.minutes > a.minutes ? b : a));
  const quietest = data.cells.reduce((a, b) => (b.minutes < a.minutes ? b : a));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Weekly rhythm</h2>
        <span className="text-xs text-slate-400">{subtext}</span>
      </div>

      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "1.7rem repeat(7, minmax(0, 1fr))" }}>
        <div />
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={`text-center text-[10px] ${
              i === now.dow ? "font-semibold text-sky-600 dark:text-sky-400" : "text-slate-400"
            }`}
          >
            {day}
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
                  className={`h-4 rounded-[3px] transition ${isNow ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
                  style={{
                    background: c ? heatColor(norm(c.minutes)) : "transparent",
                    opacity: c ? (c.source === "actual" ? 1 : 0.6) : 0.15,
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
          ) : bestToday ? (
            <span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Best today</span> · around{" "}
              {hourLabel(bestToday.hod)} ({bestToday.minutes} min)
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

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Quietest:{" "}
        <span className="text-emerald-600 dark:text-emerald-400">
          {DAYS[quietest.dow]} ~{hourLabel(quietest.hod)}
        </span>{" "}
        ({quietest.minutes} min). Busiest:{" "}
        <span className="text-rose-600 dark:text-rose-400">
          {DAYS[busiest.dow]} ~{hourLabel(busiest.hod)}
        </span>{" "}
        ({busiest.minutes} min).
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        {data.canonical
          ? `Dimmed cells are predictions; solid cells are measured. ${data.totalActual} live reading${data.totalActual === 1 ? "" : "s"} so far.`
          : "Predicted from Mapbox traffic patterns for your route."}
      </p>
    </div>
  );
}
