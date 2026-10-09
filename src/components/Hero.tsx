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

// Ambient wash behind the hero, keyed to the verdict tone.
const GLOW: Record<Tone, string> = {
  emerald: "rgba(16,185,129,0.16)",
  amber: "rgba(245,158,11,0.16)",
  rose: "rgba(244,63,94,0.16)",
  slate: "rgba(148,163,184,0.10)",
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
  const worst = forecast?.worst?.minutes ?? null;
  // The gauge runs from a clear run to well past "heavy", on the same scale
  // the verdict uses, so a green "Clear" can never sit at the red end.
  const lo = call.base;
  const hi = lo != null && call.heavyAt != null ? Math.max(lo + Math.round(call.heavyAt * 1.35), worst ?? 0) : null;
  const hasGauge = now != null && lo != null && hi != null;
  const pct = hasGauge ? Math.max(0, Math.min(1, (now - lo) / (hi - lo))) * 100 : 50;
  const asOf = forecast ? new Date(forecast.generatedAt) : null;

  return (
    <section className="relative animate-fade-up overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(2,6,23,0.04),0_16px_40px_-24px_rgba(2,6,23,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-72 rounded-full blur-2xl"
        style={{ background: `radial-gradient(closest-side, ${GLOW[call.tone]}, transparent)`, transition: "background 0.8s ease" }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Leave now</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-serif text-6xl leading-none tabular-nums">
              {shownNow ?? (loading ? "··" : "—")}
            </span>
            <span className="pb-1 text-lg text-slate-400">min</span>
          </div>
          {forecast?.distanceMi != null && asOf && (
            <p className="mt-1 text-xs text-slate-400">
              {forecast.distanceMi.toFixed(1)} mi door to door · live as of{" "}
              {asOf.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}
            </p>
          )}
        </div>
        <span
          role="status"
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${PILL[call.tone]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {call.verdict}
        </span>
      </div>

      {hasGauge && (
        <div className="mt-6">
          <div
            className="relative h-2 rounded-full"
            style={{ background: "linear-gradient(90deg,#16a34a,#eab308,#ef4444)" }}
          >
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow dark:border-slate-900 dark:bg-white"
              style={{ left: `clamp(8px, ${pct}%, calc(100% - 8px))`, transition: "left 0.7s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{lo} min · clear run</span>
            <span>{hi}+ min · heavy</span>
          </div>
        </div>
      )}

      {forecast?.freeFlow != null && call.delay != null && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          A clear run is{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{forecast.freeFlow} min</span>.{" "}
          {call.delay === 0 ? (
            "Traffic is adding nothing right now."
          ) : (
            <>
              Traffic is adding about{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">{call.delay} min</span> right now.
            </>
          )}
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
