"use client";

import { useEffect, useState } from "react";
import { BridgeCam } from "./BridgeCam";

type Incident = {
  id: string;
  type: string;
  roads: string[];
  direction: string | null;
  description: string;
};
type Weather = { tempF: number; precipIn: number; code: number; windMph: number } | null;
type ConditionsData = { incidents: Incident[]; omitted?: number; weather: Weather };

function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "—";
}

function dayContext(): { tag: string; note: string } | null {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "numeric",
  }).formatToParts(new Date());
  const wd = p.find((x) => x.type === "weekday")?.value;
  const month = Number(p.find((x) => x.type === "month")?.value ?? "0");
  const summer = month >= 5 && month <= 9;
  if (wd === "Sat")
    return {
      tag: "Sat · turnover day",
      note: "Saturday is rental changeover — the heaviest bridge day, worst late morning to mid-afternoon.",
    };
  if (wd === "Sun")
    return { tag: "Sun", note: "Weekend day-trippers head home through the late afternoon." };
  if (wd === "Fri")
    return { tag: "Fri", note: "Weekend arrivals build across the afternoon and evening." };
  if (summer)
    return { tag: "Beach season", note: "Summer volume runs heavier in mornings and late afternoons." };
  return null;
}

function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Conditions() {
  const [data, setData] = useState<ConditionsData | null>(null);
  const ctx = dayContext();

  useEffect(() => {
    fetch("/api/conditions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const w = data?.weather;
  const incidents = data?.incidents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">On the bridge now</h2>
        <a
          href="https://drivenc.gov/"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-700 hover:underline dark:text-sky-400"
        >
          DriveNC ↗
        </a>
      </div>

      <BridgeCam />

      {/* condition chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {w && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {w.tempF}° · {wmoLabel(w.code)}
          </span>
        )}
        {w && w.precipIn > 0 && (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
            Rain now — drive runs slower
          </span>
        )}
        {w && w.windMph >= 20 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Wind {w.windMph} mph
          </span>
        )}
        {ctx && (
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
            {ctx.tag}
          </span>
        )}
      </div>

      {ctx && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{ctx.note}</p>}

      {/* incidents */}
      <div className="space-y-2">
        {!data ? (
          <p className="text-xs text-slate-400">Checking the route…</p>
        ) : incidents.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            No roadwork or incidents reported on the route.
          </p>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <p className="font-medium text-amber-900 dark:text-amber-300">
                {titleCase(inc.type)}
                {inc.roads.length > 0 && ` · ${inc.roads.join(", ")}`}
                {inc.direction && ` (${inc.direction})`}
              </p>
              {inc.description && (
                <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">{inc.description}</p>
              )}
            </div>
          ))
        )}
        {data && (data.omitted ?? 0) > 0 && (
          <a
            href="https://drivenc.gov/"
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            +{data.omitted} more nearby on DriveNC ↗
          </a>
        )}
      </div>
    </div>
  );
}
