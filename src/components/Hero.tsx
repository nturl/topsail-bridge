"use client";

import { useEffect, useRef, useState } from "react";
import type { ConditionsData, Forecast } from "@/lib/types";
import { buildCall, type Tone } from "@/lib/call";

// Ease the big number between refreshes instead of snapping. First paint and
// reduced-motion render the value directly.
function useCountUp(target: number | null): number | null {
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (
      target == null ||
      from == null ||
      from === target ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

const PILL: Record<Tone, string> = {
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function Hero({
  forecast,
  conditions,
  loading,
}: {
  forecast: Forecast | null;
  conditions: ConditionsData | null;
  loading: boolean;
}) {
  const call = buildCall(forecast, conditions);
  const now = forecast?.now ?? null;
  const shownNow = useCountUp(now);
  const best = forecast?.best?.minutes ?? null;
  const worst = forecast?.worst?.minutes ?? null;
  const hasGauge = now != null && best != null && worst != null && worst > best;
  const pct = hasGauge ? Math.max(0, Math.min(1, (now - best) / (worst - best))) * 100 : 50;

  return (
    <section className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Leave now</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-serif text-6xl leading-none tabular-nums">
              {shownNow ?? (loading ? "··" : "—")}
            </span>
            <span className="pb-1 text-lg text-slate-400">min</span>
          </div>
          {forecast?.distanceMi != null && (
            <p className="mt-1 text-xs text-slate-400">{forecast.distanceMi.toFixed(1)} mi door to door</p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${PILL[call.tone]}`}>{call.verdict}</span>
      </div>

      {hasGauge && (
        <div className="mt-6">
          <div
            className="relative h-2 rounded-full"
            style={{ background: "linear-gradient(90deg,#16a34a,#eab308,#ef4444)" }}
          >
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow dark:border-slate-900 dark:bg-white"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{best} min best · {forecast?.best?.clock}</span>
            <span>up to {worst} min · {forecast?.worst?.clock}</span>
          </div>
        </div>
      )}

      {forecast?.freeFlow != null && now != null && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          A clear run is{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{forecast.freeFlow} min</span>. The bridge is
          adding about{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {Math.max(0, now - forecast.freeFlow)} min
          </span>{" "}
          right now.
        </p>
      )}

      <p className="mt-5 text-[15px] font-medium leading-snug text-slate-800 dark:text-slate-100">
        {call.headline}
      </p>
      {call.notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {call.notes.map((n, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
