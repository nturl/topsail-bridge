"use client";

import { useMemo, useState } from "react";
import type { HistoryCell, HistoryData } from "@/lib/types";
import { heatFill, heatScale, hourLabel } from "@/lib/heat";
import { dayContext } from "@/lib/context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Dir = "out" | "back";

type DayOption = {
  offset: number; // days from today
  dow: number;
  label: string; // "Today" / "Wed"
  dayNum: string; // "10"
  fullLabel: string; // "Saturday, October 10", for screen readers
  turnover: boolean; // weekend or holiday changeover
  ctxNote: string | null;
};

// Departure windows the planner compares within. Hours are bar hours (the
// cell for 8 covers departures from 8:00 to 8:59).
const WINDOWS = [
  { key: "am", label: "Morning", range: "6a-12p", hours: [6, 7, 8, 9, 10, 11] },
  { key: "pm", label: "Afternoon", range: "12p-6p", hours: [12, 13, 14, 15, 16, 17] },
  { key: "eve", label: "Evening", range: "6p-9p", hours: [18, 19, 20, 21] },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];

function windowOf(h: number): WindowKey {
  return h >= 18 ? "eve" : h >= 12 ? "pm" : "am";
}

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
      weekday: "long",
      month: "long",
      day: "numeric",
    }).formatToParts(date);
    const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    const wd = get("weekday").slice(0, 3);
    const dow = DAYS.indexOf(wd);
    const ctx = dayContext(date);
    out.push({
      offset,
      dow,
      label: offset === 0 ? "Today" : wd,
      dayNum: get("day"),
      fullLabel: `${get("weekday")}, ${get("month")} ${get("day")}`,
      turnover: dow === 0 || dow === 6 || !!ctx?.turnover,
      ctxNote: ctx?.note ?? null,
    });
  }
  return out;
}

// Opening window: the one containing now for today, Morning for any other day.
function defaultWindow(offset: number, hour: number): WindowKey {
  return offset === 0 && hour >= 6 ? windowOf(Math.min(hour, 21)) : "am";
}

type Bar = { h: number; cell: HistoryCell | null; past: boolean; t: number };
type Open = Bar & { cell: HistoryCell };

// The one bold line: when to go within the chosen window, and what waiting costs.
function windowRead(
  open: Open[],
  dayOpen: Open[],
  win: (typeof WINDOWS)[number],
  nowHour: number | null,
): { text: string; tone: "good" | "warn" | "muted" } {
  if (dayOpen.length) {
    const lo = Math.min(...dayOpen.map((b) => b.cell.minutes));
    const hi = Math.max(...dayOpen.map((b) => b.cell.minutes));
    // Today only counts the hours still ahead, so say so.
    const easy = nowHour != null && nowHour >= 6 ? "Easy the rest of today" : "Easy all day";
    if (hi - lo < 4) return { text: lo === hi ? `${easy}: about ${lo} min.` : `${easy}: ${lo} to ${hi} min.`, tone: "good" };
  }
  if (!open.length) return { text: `${win.label} has passed. Pick a later window.`, tone: "muted" };

  const min = Math.min(...open.map((b) => b.cell.minutes));
  const worst = open.reduce((a, b) => (b.cell.minutes > a.cell.minutes ? b : a));
  const d = worst.cell.minutes - min;
  if (d < 2) return { text: `${win.label} is steady: about ${min} min.`, tone: "good" };

  const near = (b: Open) => b.cell.minutes <= min + 1;
  const firstBest = open.find((b) => b.cell.minutes === min)!;
  if (firstBest.h < worst.h) {
    // Build-up ahead: the latest hour still near the best before it turns.
    const go = [...open].reverse().find((b) => b.h < worst.h && near(b))!;
    const lead = go.h === nowHour ? "Leave now" : `Leave by ${hourLabel(go.h)}`;
    return {
      text: `${lead}: ${go.cell.minutes} min. By ${hourLabel(worst.h)} it's ${worst.cell.minutes} min (+${worst.cell.minutes - go.cell.minutes}).`,
      tone: "good",
    };
  }
  // Easing off: the first hour after the peak that is near the best.
  const go = open.find((b) => b.h > worst.h && near(b))!;
  return {
    text: `Wait until ${hourLabel(go.h)}: ${go.cell.minutes} min. At ${hourLabel(worst.h)} it's ${worst.cell.minutes} min (+${worst.cell.minutes - go.cell.minutes}).`,
    tone: "warn",
  };
}

export function TripPlanner({
  data,
  dir,
  onDirChange,
}: {
  data: HistoryData | null;
  dir: Dir;
  onDirChange?: (d: Dir) => void;
}) {
  const now = useMemo(etNow, []);
  const days = useMemo(buildDays, []);
  // After ~8 PM today's window is gone; open on tomorrow instead.
  const [offset, setOffset] = useState(() => (now.hour >= 20 ? 1 : 0));
  const [win, setWin] = useState<WindowKey>(() => defaultWindow(now.hour >= 20 ? 1 : 0, now.hour));
  const [selHour, setSelHour] = useState<number | null>(null);

  const subtext = dir === "out" ? "leaving the island" : "coming back";
  const day = days[offset];
  const slot = WINDOWS.find((w) => w.key === win)!;
  const satOffset = days.find((d) => d.dow === 6)?.offset ?? null;

  const pickDay = (o: number) => {
    setOffset(o);
    setWin(defaultWindow(o, now.hour));
    setSelHour(null);
  };

  // Renter shortcuts: check-in is usually 4p (coming back onto the island),
  // check-out 10a (leaving it), both on Saturday.
  const quick = (d: Dir) => {
    if (satOffset == null || !onDirChange) return;
    setOffset(satOffset);
    setWin(d === "back" ? "pm" : "am");
    setSelHour(d === "back" ? 16 : 10);
    onDirChange(d);
  };

  const { bars, read, best } = useMemo(() => {
    if (!data) return { bars: [] as Bar[], read: null, best: null };
    const norm = heatScale(data.cells.map((c) => c.minutes)).norm;
    const byHod = new Map<number, HistoryCell>();
    for (const c of data.cells) if (c.dow === day.dow) byHod.set(c.hod, c);
    const bars: Bar[] = data.hours.map((h) => {
      const cell = byHod.get(h) ?? null;
      const past = day.offset === 0 && h < now.hour;
      return { h, cell, past, t: cell ? norm(cell.minutes) : 0 };
    });
    const dayOpen = bars.filter((b): b is Open => !!b.cell && !b.past);
    const open = dayOpen.filter((b) => (slot.hours as readonly number[]).includes(b.h));
    const best = dayOpen.length ? dayOpen.reduce((a, b) => (b.cell.minutes < a.cell.minutes ? b : a)) : null;
    const read = dayOpen.length ? windowRead(open, dayOpen, slot, day.offset === 0 ? now.hour : null) : null;
    return { bars, read, best };
  }, [data, day, now.hour, slot]);

  // Bars that get their minutes printed above them: the selected hour plus the
  // quickest and slowest open hours in the window.
  const labeled = useMemo(() => {
    const s = new Set<number>();
    const open = bars.filter((b) => b.cell && !b.past && (slot.hours as readonly number[]).includes(b.h));
    if (open.length > 1) {
      s.add(open.reduce((a, b) => (b.cell!.minutes < a.cell!.minutes ? b : a)).h);
      s.add(open.reduce((a, b) => (b.cell!.minutes > a.cell!.minutes ? b : a)).h);
    }
    if (selHour != null) s.add(selHour);
    return s;
  }, [bars, slot, selHour]);

  const header = (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        Plan a trip
      </h2>
      <span className="text-xs text-slate-500 dark:text-slate-400">{subtext}</span>
    </div>
  );

  if (!data) {
    return (
      <div>
        {header}
        <div className="flex h-36 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 motion-safe:animate-pulse dark:bg-slate-800 dark:text-slate-400">
          Learning this route&apos;s rhythm…
        </div>
      </div>
    );
  }
  if (!data.cells.length) return null;

  const sel = selHour != null ? (bars.find((b) => b.h === selHour && b.cell && !b.past) ?? null) : null;
  const dayDone = day.offset === 0 && bars.length > 0 && bars.every((b) => b.past || !b.cell);
  const dayName = day.offset === 0 ? "Today" : DAYS[day.dow];
  const anyPast = bars.some((b) => b.past && b.cell);

  const chip = (active: boolean) =>
    `pressable rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-200"
        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"
    }`;

  return (
    <div>
      {header}

      {/* Renter shortcuts (only when the page lets us flip direction) */}
      {onDirChange && satOffset != null && (
        <div className="mb-3 flex gap-2" role="group" aria-label="Rental Saturday shortcuts">
          <button
            type="button"
            onClick={() => quick("back")}
            aria-pressed={offset === satOffset && dir === "back"}
            className={chip(offset === satOffset && dir === "back")}
          >
            Arrive Sat
          </button>
          <button
            type="button"
            onClick={() => quick("out")}
            aria-pressed={offset === satOffset && dir === "out"}
            className={chip(offset === satOffset && dir === "out")}
          >
            Check out Sat
          </button>
        </div>
      )}

      {/* Day picker: seven equal columns, never scrolls */}
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Pick a day">
        {days.map((d) => {
          const on = d.offset === offset;
          return (
            <button
              key={d.offset}
              type="button"
              aria-pressed={on}
              aria-label={`${d.offset === 0 ? "Today, " : ""}${d.fullLabel}${d.turnover ? ", rental turnover day" : ""}`}
              onClick={() => pickDay(d.offset)}
              className={`pressable relative flex min-h-11 flex-col items-center justify-center rounded-xl py-1.5 text-xs transition-colors ${
                on
                  ? "bg-sky-600 text-white shadow-sm"
                  : d.offset === 0
                    ? "bg-sky-50 text-sky-800 ring-1 ring-sky-300 ring-inset dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-700"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <span className="font-medium">{d.label}</span>
              <span className={on ? "text-sky-100" : "text-slate-500 dark:text-slate-400"}>{d.dayNum}</span>
              {d.turnover && (
                <span
                  aria-hidden
                  className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${on ? "bg-amber-300" : "bg-amber-500"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Departure window */}
      <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Time of day">
        {WINDOWS.map((w) => {
          const on = w.key === win;
          return (
            <button
              key={w.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setWin(w.key);
                setSelHour(null);
              }}
              className={`pressable flex min-h-11 flex-col items-center justify-center rounded-xl text-xs transition-colors ${
                on
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <span className="font-medium">{w.label}</span>
              <span className={on ? "opacity-75" : "text-slate-500 dark:text-slate-400"}>{w.range}</span>
            </button>
          );
        })}
      </div>

      {/* The answer */}
      <p
        className={`mt-3 min-h-10 text-[15px] leading-snug font-semibold ${
          dayDone || read?.tone === "muted"
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-900 dark:text-white"
        }`}
        aria-live="polite"
      >
        {dayDone ? "Today's window has passed. Tap tomorrow." : (read?.text ?? "")}
      </p>

      {/* Hour bars, 6a-9p. Each whole column is the tap target. */}
      <div className="mt-2 flex items-end" role="group" aria-label={`${dayName} drive time by hour`}>
        {bars.map((b, i) => {
          const inWin = (slot.hours as readonly number[]).includes(b.h);
          const prevIn = i > 0 && (slot.hours as readonly number[]).includes(bars[i - 1].h);
          const nextIn = i < bars.length - 1 && (slot.hours as readonly number[]).includes(bars[i + 1].h);
          const usable = !!b.cell && !b.past;
          const isSel = selHour === b.h && usable;
          return (
            <button
              key={b.h}
              type="button"
              disabled={!usable}
              aria-pressed={usable ? isSel : undefined}
              aria-label={
                b.cell
                  ? b.past
                    ? `${hourLabel(b.h)}, already passed`
                    : `${dayName} ${hourLabel(b.h)}: ${b.cell.minutes} minutes, ${b.cell.source === "actual" ? "measured" : "predicted"}`
                  : `${hourLabel(b.h)}, no data`
              }
              onClick={() => {
                if (b.h === selHour) return setSelHour(null);
                setSelHour(b.h);
                setWin(windowOf(b.h));
              }}
              className={`flex h-[78px] min-w-0 flex-1 flex-col justify-end px-[1.5px] pt-1 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-[-2px] ${
                inWin ? "bg-sky-50 dark:bg-sky-950/50" : ""
              } ${inWin && !prevIn ? "rounded-l-lg" : ""} ${inWin && !nextIn ? "rounded-r-lg" : ""}`}
            >
              <span
                aria-hidden
                className={`h-3.5 text-center text-[10px] leading-none tabular-nums ${
                  isSel ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {usable && labeled.has(b.h) ? b.cell!.minutes : ""}
              </span>
              <span className="flex h-[58px] items-end" aria-hidden>
                <span
                  className={`block w-full rounded-t-[4px] motion-safe:transition-[height] motion-safe:duration-500 ${
                    b.past ? "bg-slate-200 dark:bg-slate-700" : ""
                  } ${isSel ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
                  style={{
                    height: b.cell ? `${18 + b.t * 82}%` : "6%",
                    background: b.cell && !b.past ? heatFill(b.t, b.cell.source !== "actual") : undefined,
                    opacity: b.cell ? 1 : 0.15,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex text-[11px] text-slate-500 dark:text-slate-400" aria-hidden>
        {bars.map((b) => (
          <span key={b.h} className="flex-1 text-center whitespace-nowrap">
            {b.h % 3 === 0 ? hourLabel(b.h) : ""}
          </span>
        ))}
      </div>

      {/* Tap readout */}
      <p className="mt-2 min-h-4 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
        {sel && sel.cell ? (
          <>
            <span className="font-medium">
              {dayName} {hourLabel(sel.h)}: {sel.cell.minutes} min
            </span>
            {best && best.h !== sel.h && sel.cell.minutes > best.cell.minutes ? (
              <>
                ,{" "}
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  +{sel.cell.minutes - best.cell.minutes} vs {hourLabel(best.h)}
                </span>
              </>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">, the quickest hour</span>
            )}
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              ({sel.cell.source === "actual" ? `measured, ${sel.cell.samples} readings` : "predicted"})
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">Tap a bar to compare any hour.</span>
        )}
      </p>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: heatFill(0.4, false) }} />
          Measured
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: heatFill(0.4, true) }} />
          Predicted
        </span>
        {anyPast && (
          <span className="flex items-center gap-1">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-700" />
            Passed
          </span>
        )}
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Turnover day
        </span>
      </div>

      {day.ctxNote && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{day.ctxNote}</p>
      )}
    </div>
  );
}
