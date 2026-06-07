"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConditionsData, Forecast, Place } from "@/lib/types";
import { DEFAULT_ORIGIN, DEFAULT_DEST } from "@/lib/places";
import { Hero } from "@/components/Hero";
import { ForecastChart } from "@/components/ForecastChart";
import { Conditions } from "@/components/Conditions";
import { Heatmap } from "@/components/Heatmap";
import { RouteMap } from "@/components/RouteMap";
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

const CARD =
  "animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default function Page() {
  const [route, setRoute] = useState<Route>({ origin: DEFAULT_ORIGIN, dest: DEFAULT_DEST });
  const [hydrated, setHydrated] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [conditions, setConditions] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setRoute(loadRoute());
    setHydrated(true);
  }, []);

  const refresh = useCallback(async (r: Route) => {
    setLoading(true);
    setError(null);
    try {
      const o = `${r.origin.lng},${r.origin.lat}`;
      const d = `${r.dest.lng},${r.dest.lat}`;
      const [fRes, cRes] = await Promise.all([
        fetch(`/api/forecast?o=${o}&d=${d}`, { cache: "no-store" }),
        fetch(`/api/conditions`, { cache: "no-store" }),
      ]);
      if (!fRes.ok) throw new Error("forecast");
      setForecast((await fRes.json()) as Forecast);
      if (cRes.ok) setConditions((await cRes.json()) as ConditionsData);
      setUpdatedAt(new Date());
    } catch {
      setError("Couldn't load traffic right now. Try refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated) refresh(route);
  }, [route, hydrated, refresh]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => refresh(route), 120_000);
    return () => clearInterval(id);
  }, [route, hydrated, refresh]);

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

  const hasCurve = !!forecast && forecast.points.filter((p) => p.minutes != null).length > 1;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-7 animate-fade-up">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Bridge Watch</h1>
          <span className="text-xs text-slate-400">Surf City bridge</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {route.origin.label} → {route.dest.label}
        </p>
      </header>

      {error && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Hero forecast={forecast} conditions={conditions} loading={loading} />
          {hasCurve && forecast && (
            <section className={CARD} style={{ animationDelay: "120ms" }}>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Next 3 hours</h2>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> best window
                </span>
              </div>
              <ForecastChart forecast={forecast} />
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className={CARD} style={{ animationDelay: "80ms" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">The route</h2>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> bridge
              </span>
            </div>
            <RouteMap origin={route.origin} dest={route.dest} />
          </section>
          <section className={CARD} style={{ animationDelay: "100ms" }}>
            <Conditions data={conditions} />
          </section>
          <section className={CARD} style={{ animationDelay: "180ms" }}>
            <Heatmap />
          </section>
        </div>
      </div>

      <section className="mx-auto mt-6 max-w-md space-y-3">
        <RouteControls origin={route.origin} dest={route.dest} onApply={applyRoute} onReset={resetRoute} />
        <div className="flex items-center justify-between text-xs text-slate-400">
          <button onClick={() => refresh(route)} className="hover:text-slate-600 dark:hover:text-slate-200">
            ↻ Refresh
          </button>
          <span>
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
        </div>
        <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-400">
          Traffic-aware estimates from Mapbox. Predictions blend live and historical patterns.
        </p>
      </section>
    </main>
  );
}
