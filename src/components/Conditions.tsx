"use client";

import Link from "next/link";
import { Cameras } from "./Cameras";
import { wmoLabel } from "@/lib/context";
import type { ConditionsData } from "@/lib/types";

// Mornings care about sunrise, the rest of the day about sunset.
function etHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
}

// Official pages only: parking rates differ between sources, so link rather than quote.
const BEACH_LINKS = [
  { label: "Surf City parking map", href: "https://pivot.park.tez.io/map/surf-city" },
  { label: "Topsail Beach parking", href: "https://topsailbeachnc.gov/Visitors/Public-Accesses-and-Parking" },
  {
    label: "Swim advisories",
    href: "https://www.deq.nc.gov/about/divisions/marine-fisheries/shellfish-sanitation-and-recreational-water-quality/recreational-water-quality",
  },
];

const RIP_TONE = {
  Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  High: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
} as const;

export function Conditions({ data }: { data: ConditionsData | null }) {
  const w = data?.weather;
  const beach = data?.beach ?? null;
  const incidents = data?.incidents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">On the bridge now</h2>
        <Link href="/cams" className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
          All cams →
        </Link>
      </div>

      <Cameras />

      <div className="flex flex-wrap gap-2 text-xs">
        {w && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {w.tempF}° · {wmoLabel(w.code)}
          </span>
        )}
        {w && w.precipIn > 0 && (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
            Rain now
          </span>
        )}
        {w && (w.windMph >= 20 || (w.gustMph ?? 0) >= 30) && (
          <span
            className={
              w.windMph >= 35
                ? "rounded-full bg-rose-100 px-2.5 py-1 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                : "rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            }
          >
            Wind {w.windMph} mph{w.gustMph ? `, gusts ${w.gustMph}` : ""}
          </span>
        )}
        {beach && (
          <a
            href="https://www.weather.gov/beach/ilm"
            target="_blank"
            rel="noreferrer"
            title="NWS Surf Zone Forecast for Surf City and Topsail Beach"
            className={`rounded-full px-2.5 py-1 hover:opacity-80 ${RIP_TONE[beach.rip]}`}
          >
            {beach.rip} rip risk
            {beach.next && beach.next.rip !== beach.rip ? `, ${beach.next.rip.toLowerCase()} ${beach.next.label}` : ""}
          </a>
        )}
        {beach?.surf && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Surf {beach.surf.replace(/^around /i, "~").replace(/ feet$/i, " ft")}
          </span>
        )}
        {beach?.water && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Water {beach.water}
          </span>
        )}
        {(data?.tides ?? []).map((t) => (
          <span
            key={t.type}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {t.type === "high" ? "High tide" : "Low tide"} {t.clock}
          </span>
        ))}
        {data?.sun && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {etHour() < 11 ? `Sunrise ${data.sun.sunriseClock}` : `Sunset ${data.sun.sunsetClock}`}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {!data ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Checking NCDOT alerts…</p>
        ) : data.incidentsDown ? (
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            NCDOT alerts are unavailable right now.{" "}
            <a href="https://drivenc.gov/" target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
              Check DriveNC ↗
            </a>
          </p>
        ) : incidents.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            No NCDOT alerts on the route.
          </p>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              className={
                inc.severe
                  ? "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-500/20 dark:bg-rose-500/10"
                  : "rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-500/20 dark:bg-amber-500/10"
              }
            >
              <p
                className={
                  inc.severe
                    ? "font-medium text-rose-900 dark:text-rose-300"
                    : "font-medium text-amber-900 dark:text-amber-300"
                }
              >
                {inc.when && "Upcoming · "}
                {inc.type}
                {inc.roads.length > 0 && ` · ${inc.roads.join(", ")}`}
                {inc.direction && ` (${inc.direction})`}
                {inc.when && ` · ${inc.when}`}
              </p>
              {inc.description && (
                <p
                  className={
                    inc.severe
                      ? "mt-0.5 text-rose-800/80 dark:text-rose-200/70"
                      : "mt-0.5 text-amber-800/80 dark:text-amber-200/70"
                  }
                >
                  {inc.description}
                </p>
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

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Beach day:{" "}
        {BEACH_LINKS.map((l, i) => (
          <span key={l.href}>
            {i > 0 && " · "}
            <a href={l.href} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
              {l.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
