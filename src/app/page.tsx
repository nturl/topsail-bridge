"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConditionsData, Forecast, HistoryData, Place } from "@/lib/types";
import { Hero } from "@/components/Hero";
import { ForecastChart } from "@/components/ForecastChart";
import { Conditions } from "@/components/Conditions";
import { Heatmap } from "@/components/Heatmap";
import { RouteMap } from "@/components/RouteMap";
import { RouteEditor } from "@/components/RouteEditor";
import { TripPlanner } from "@/components/TripPlanner";

const LS_KEY = "bw.route.v1";

type Route = { origin: Place; dest: Place };
type Direction = "out" | "back";

function loadRoute(): Route | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Route;
  } catch {
    /* ignore */
  }
  return null;
}

const CARD =
  "animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default function Page() {
  const [route, setRoute] = useState<Route | null>(null);
  const [direction, setDirection] = useState<Direction>("out");
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [conditions, setConditions] = useState<ConditionsData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    setRoute(loadRoute());
    // PWA shortcuts deep-link straight into a direction (/?dir=back).
    try {
      if (new URLSearchParams(window.location.search).get("dir") === "back") setDirection("back");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Bridge conditions (cam, weather, tides, incidents) are route-independent: always load.
  const fetchConditions = useCallback(async () => {
    lastFetchRef.current = Date.now();
    try {
      const r = await fetch("/api/conditions", { cache: "no-store" });
      if (r.ok) setConditions((await r.json()) as ConditionsData);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetchConditions();
    const id = setInterval(fetchConditions, 300_000);
    return () => clearInterval(id);
  }, [hydrated, fetchConditions]);

  // Forecast needs a route.
  const fetchForecast = useCallback(async (r: Route, dir: Direction) => {
    const from = dir === "out" ? r.origin : r.dest;
    const to = dir === "out" ? r.dest : r.origin;
    lastFetchRef.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?o=${from.lng},${from.lat}&d=${to.lng},${to.lat}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("forecast");
      setForecast((await res.json()) as Forecast);
      setUpdatedAt(new Date());
    } catch {
      setError("Couldn't load traffic right now. Try refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && route) fetchForecast(route, direction);
  }, [route, direction, hydrated, fetchForecast]);

  useEffect(() => {
    if (!hydrated || !route) return;
    const id = setInterval(() => fetchForecast(route, direction), 120_000);
    return () => clearInterval(id);
  }, [route, direction, hydrated, fetchForecast]);

  // Weekly history powers both the trip planner and the heatmap; fetch it once
  // per route + direction up here and share it.
  useEffect(() => {
    if (!hydrated || !route) {
      setHistory(null);
      return;
    }
    const from = direction === "out" ? route.origin : route.dest;
    const to = direction === "out" ? route.dest : route.origin;
    let cancelled = false;
    setHistory(null);
    fetch(`/api/history?o=${from.lng},${from.lat}&d=${to.lng},${to.lat}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setHistory(j as HistoryData);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, route, direction]);

  // PWAs reopen from the background a lot; refetch when the app comes back
  // (stale after 2 min) or when the connection returns.
  useEffect(() => {
    const refresh = () => {
      if (Date.now() - lastFetchRef.current < 120_000) return;
      fetchConditions();
      if (route) fetchForecast(route, direction);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onOnline = () => {
      setOffline(false);
      refresh();
    };
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [route, direction, fetchForecast, fetchConditions]);

  function applyRoute(origin: Place, dest: Place) {
    const r = { origin, dest };
    setRoute(r);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  }

  const from = route ? (direction === "out" ? route.origin : route.dest) : null;
  const to = route ? (direction === "out" ? route.dest : route.origin) : null;
  const hasCurve = !!forecast && forecast.points.filter((p) => p.minutes != null).length > 1;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:py-12">
      <header className="mb-5 animate-fade-up">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Topsail Traffic</h1>
          <span className="text-xs text-slate-400">Surf City bridge</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          When to leave (and return to) Topsail Island.
        </p>
      </header>

      {/* Route control */}
      <div className="mb-5 animate-fade-up space-y-3">
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">Your route</span>
            {route && from && to ? (
              <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                {from.label} → {to.label}
              </span>
            ) : (
              <span className="block truncate font-medium text-slate-400">
                Set your starting point and destination
              </span>
            )}
          </span>
          <span className="shrink-0 text-sm font-medium text-sky-600 dark:text-sky-400">
            {route ? "Edit" : "Set route"}
          </span>
        </button>

        {route && (
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-800 dark:bg-slate-900">
            {(["out", "back"] as Direction[]).map((dval) => (
              <button
                key={dval}
                onClick={() => setDirection(dval)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${
                  direction === dval
                    ? "bg-sky-600 text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {dval === "out" ? "Leaving" : "Returning"}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && route && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {route && from && to ? (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <Hero forecast={forecast} conditions={conditions} loading={loading} />
            <section className={CARD} style={{ animationDelay: "100ms" }}>
              <Conditions data={conditions} />
            </section>
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
              <RouteMap origin={from} dest={to} />
            </section>
            <section className={CARD} style={{ animationDelay: "140ms" }}>
              <TripPlanner data={history} dir={direction} />
            </section>
            <section className={CARD} style={{ animationDelay: "180ms" }}>
              <Heatmap data={history} dir={direction} />
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <section className={`${CARD} text-center`}>
            <p className="mx-auto max-w-sm text-[15px] leading-snug text-slate-700 dark:text-slate-200">
              Set your route to see live and predicted drive times across the Surf City bridge, your weekly
              rhythm, and the best windows to go.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="mt-4 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Set your route
            </button>
          </section>
          <section className={CARD} style={{ animationDelay: "80ms" }}>
            <Conditions data={conditions} />
          </section>
        </div>
      )}

      <section className="mt-6 flex items-center justify-between text-xs text-slate-400">
        {route ? (
          <button
            onClick={() => {
              fetchForecast(route, direction);
              fetchConditions();
            }}
            className="hover:text-slate-600 dark:hover:text-slate-200"
          >
            ↻ Refresh
          </button>
        ) : (
          <span />
        )}
        <span>
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </span>
      </section>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
        Live + predicted traffic from Mapbox. Bridge cam by Surf City IGA, incidents from NCDOT DriveNC, tides
        from NOAA.
      </p>

      {offline && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center">
          <span className="rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-slate-900">
            Offline · showing the last data
          </span>
        </div>
      )}

      <RouteEditor
        open={editing}
        origin={route?.origin ?? null}
        dest={route?.dest ?? null}
        onApply={applyRoute}
        onClose={() => setEditing(false)}
      />
    </main>
  );
}
