"use client";

import { useCallback, useEffect, useState } from "react";
import type { Forecast, Place } from "@/lib/types";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import { ForecastChart } from "@/components/ForecastChart";
import { RouteControls } from "@/components/RouteControls";

const LS_KEY = "bw.route.v1";

type Route = { origin: Place; dest: Place };

function loadRoute(): Route {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Route;
  } catch {
    /* ignore */
  }
  return { origin: DEFAULT_ORIGIN, dest: DEFAULT_DEST };
}

const TONES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function verdictFor(f: Forecast | null): { label: string; tone: string } {
  if (!f || f.now == null || f.best?.minutes == null) return { label: "—", tone: "slate" };
  const over = f.now - f.best.minutes;
  if (over <= 3) return { label: "Clear", tone: "emerald" };
  if (over <= 8) return { label: "Moderate", tone: "amber" };
  return { label: "Heavy", tone: "rose" };
}

function adviceFor(f: Forecast | null): string {
  if (!f || f.now == null || !f.best) return "";
  const save = f.now - (f.best.minutes ?? f.now);
  if (f.best.offsetMin > 0 && save >= 4) {
    return `Wait until ${f.best.clock} to save about ${save} min.`;
  }
  return "Leaving now is about as good as it gets for the next 3 hours.";
}

export default function Page() {
  const [route, setRoute] = useState<Route>({ origin: DEFAULT_ORIGIN, dest: DEFAULT_DEST });
  const [hydrated, setHydrated] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setRoute(loadRoute());
    setHydrated(true);
  }, []);

  const fetchForecast = useCallback(async (r: Route) => {
    setLoading(true);
    setError(null);
    try {
      const o = `${r.origin.lng},${r.origin.lat}`;
      const d = `${r.dest.lng},${r.dest.lat}`;
      const res = await fetch(`/api/forecast?o=${o}&d=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error("bad");
      setForecast((await res.json()) as Forecast);
      setUpdatedAt(new Date());
    } catch {
      setError("Couldn't load traffic right now. Try refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated) fetchForecast(route);
  }, [route, hydrated, fetchForecast]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => fetchForecast(route), 120_000);
    return () => clearInterval(id);
  }, [route, hydrated, fetchForecast]);

  function applyRoute(origin: Place, dest: Place) {
    const r = { origin, dest };
    setRoute(r);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  }

  function resetRoute() {
    setRoute({ origin: DEFAULT_ORIGIN, dest: DEFAULT_DEST });
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }

  const verdict = verdictFor(forecast);
  const advice = adviceFor(forecast);
  const hasCurve = !!forecast && forecast.points.filter((p) => p.minutes != null).length > 1;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <header className="mb-7 animate-fade-up">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Bridge Watch</h1>
          <span className="text-xs text-slate-400">Surf City bridge</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {route.origin.label} → {route.dest.label}
        </p>
      </header>

      <section
        className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        style={{ animationDelay: "60ms" }}
      >
        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Leave now</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="font-serif text-6xl leading-none tabular-nums">
                    {forecast?.now ?? (loading ? "··" : "—")}
                  </span>
                  <span className="pb-1 text-lg text-slate-400">min</span>
                </div>
                {forecast?.distanceMi != null && (
                  <p className="mt-1 text-xs text-slate-400">
                    {forecast.distanceMi.toFixed(1)} mi door to door
                  </p>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${TONES[verdict.tone]}`}>
                {verdict.label}
              </span>
            </div>
            <p className="mt-4 text-[15px] leading-snug text-slate-700 dark:text-slate-200">{advice}</p>
            {forecast?.worst?.minutes != null &&
              forecast.best?.minutes != null &&
              forecast.worst.minutes - forecast.best.minutes >= 4 && (
                <p className="mt-1 text-xs text-slate-400">
                  Peaks around {forecast.worst.minutes} min near {forecast.worst.clock}.
                </p>
              )}
          </>
        )}
      </section>

      {hasCurve && forecast && (
        <section
          className="animate-fade-up mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          style={{ animationDelay: "120ms" }}
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Next 3 hours</h2>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> best window
            </span>
          </div>
          <ForecastChart forecast={forecast} />
        </section>
      )}

      <section className="mt-5 space-y-3">
        <RouteControls origin={route.origin} dest={route.dest} onApply={applyRoute} onReset={resetRoute} />
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={() => fetchForecast(route)}
            className="hover:text-slate-600 dark:hover:text-slate-200"
          >
            ↻ Refresh
          </button>
          <span>
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
        <p className="pt-2 text-center text-[11px] leading-relaxed text-slate-400">
          Traffic-aware estimates from Mapbox. Predictions blend live and historical patterns.
        </p>
      </section>
    </main>
  );
}
