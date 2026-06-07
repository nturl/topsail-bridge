"use client";

import { BridgeCam } from "./BridgeCam";
import { wmoLabel } from "@/lib/context";
import type { ConditionsData } from "@/lib/types";

function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Conditions({ data }: { data: ConditionsData | null }) {
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
        {w && w.windMph >= 20 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Wind {w.windMph} mph
          </span>
        )}
      </div>

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
