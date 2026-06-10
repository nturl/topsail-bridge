"use client";

import { useEffect, useMemo, useState } from "react";
import type { HistoryCell, HistoryData } from "@/lib/types";
import { heatColor, heatScale, hourLabel } from "@/lib/heat";
import { dayContext } from "@/lib/context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayOption = {
  offset: number; // days from today
  dow: number;
  label: string; // "Today" / "Wed"
  dayNum: string; // "10"
  ctxNote: string | null;
};

function etNow(): { dow: number; hour: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const wd = p.find((x) => x.type === "weekday")?.value ?? "Sun";
  return { dow: DAYS.indexOf(wd), hour: Number(p.find((x) => x.type === "hour")?.value ?? "0") };
}

function buildDays(): DayOption[] {
  const out: DayOption[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(Date.now() + offset * 86_400_000);
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      day: "numeric",
    }).formatToParts(date);
    const wd = p.find((x) => x.type === "weekday")?.value ?? "Sun";
    out.push({
      offset,
      dow: DAYS.indexOf(wd),
      label: offset === 0 ? "Today" : wd,
      dayNum: p.find((x) => x.type === "day")?.value ?? "",
      ctxNote: dayContext(date)?.note ?? null,
    });
  }
  return out;
}

export function TripPlanner({ data, dir }: { data: HistoryData | null; dir: "out" | "back" }) {
  const now = useMemo(etNow, []);
  const days = useMemo(buildDays, []);
  // After ~8 PM today's window is gone; open on tomorrow instead.
  const [offset, setOffset] = useState(() => (etNow().hour >= 20 ? 1 : 0));
  const [selHour, setSelHour] = useState<number | null>(null);

  useEffect(() => setSelHour(null), [offset, data]);

  const subtext = dir === "out" ? "leaving the island" : "coming back";
  const day = days[offset];

  const { bars, quietest, busiest } = useMemo(() => {
    if (!data) return { bars: [], quietest: null, busiest: null };
    const norm = heatScale(data.cells.map((c) => c.minutes)).norm;
    const byHod = new Map<number, HistoryCell>();
    for (const c of data.cells) if (c.dow === day.dow) byHod.set(c.hod, c);
    const bars = data.hours.map((h) => {
      const cell = byHod.get(h) ?? null;
      const past = day.offset === 0 && h <= now.hour - 1;
      return { h, cell, past, t: cell ? norm(cell.minutes) : 0 };
    });
    const open = bars.filter((b) => b.cell && !b.past) as Array<{ h: number; cell: HistoryCell }>;
    const quietest = open.length ? open.reduce((a, b) => (b.cell.minutes < a.cell.minutes ? b : a)) : null;
    const busiest = open.length ? open.reduce((a, b) => (b.cell.minutes > a.cell.minutes ? b : a)) : null;
    return { bars, quietest, busiest };
  }, [data, day, now.hour]);

  if (!data) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Plan a trip</h2>
          <span className="text-xs text-slate-400">{subtext}</span>
        </div>
        <div className="flex h-36 animate-pulse items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">
          Learning this route&apos;s rhythm…
        </div>
      </div>
    );
  }
  if (!data.cells.length) return null;

  const selCell = selHour != null ? (bars.find((b) => b.h === selHour)?.cell ?? null) : null;
  const dayDone = day.offset === 0 && bars.length > 0 && bars.every((b) => b.past || !b.cell);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Plan a trip</h2>
        <span className="text-xs text-slate-400">{subtext}</span>
      </div>

      {/* Day picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Pick a day">
        {days.map((d) => (
          <button
            key={d.offset}
            type="button"
            role="tab"
            aria-selected={d.offset === offset}
            onClick={() => setOffset(d.offset)}
            className={`flex min-w-11 shrink-0 flex-col items-center rounded-xl px-2 py-1.5 text-xs transition ${
              d.offset === offset
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="font-medium">{d.label}</span>
            <span className={d.offset === offset ? "text-sky-100" : "text-slate-400"}>{d.dayNum}</span>
          </button>
        ))}
      </div>

      {/* Hour bars, 6a-9p */}
      <div className="mt-3 flex items-end gap-[3px]" style={{ height: 56 }}>
        {bars.map((b) => (
          <button
            key={b.h}
            type="button"
            disabled={!b.cell}
            onClick={() => setSelHour(b.h === selHour ? null : b.h)}
            aria-label={b.cell ? `${day.label} ${hourLabel(b.h)}: ${b.cell.minutes} minutes` : undefined}
            className={`flex-1 rounded-t-[4px] transition ${
              selHour === b.h ? "ring-2 ring-slate-900 dark:ring-white" : ""
            }`}
            style={{
              height: b.cell ? `${22 + b.t * 78}%` : "8%",
              background: b.cell ? heatColor(b.t) : "transparent",
              opacity: b.cell ? (b.past ? 0.25 : 1) : 0.1,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-slate-400">
        {bars.map((b) => (
          <span key={b.h} className="flex-1 text-center">
            {b.h % 3 === 0 ? hourLabel(b.h) : ""}
          </span>
        ))}
      </div>

      {/* The read */}
      <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        {selCell && selHour != null ? (
          <span>
            <span className="font-medium">
              {day.offset === 0 ? "Today" : DAYS[day.dow]} {hourLabel(selHour)}
            </span>{" "}
            · {selCell.minutes} min{" "}
            <span className="text-slate-400">
              ({selCell.source === "actual" ? "measured" : "predicted"})
            </span>
          </span>
        ) : dayDone ? (
          <span className="text-slate-400">Today&apos;s window has passed. Tap tomorrow.</span>
        ) : quietest && busiest ? (
          <span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Quietest</span> around{" "}
            {hourLabel(quietest.h)} ({quietest.cell.minutes} min) ·{" "}
            <span className="font-medium text-rose-600 dark:text-rose-400">busiest</span> around{" "}
            {hourLabel(busiest.h)} ({busiest.cell.minutes} min)
          </span>
        ) : null}
      </div>

      {day.ctxNote && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{day.ctxNote}</p>
      )}
    </div>
  );
}
