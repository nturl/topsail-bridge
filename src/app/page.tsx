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
import { InstallSheet } from "@/components/InstallSheet";
import { sharePage } from "@/lib/share";
import { buildCall } from "@/lib/call";
import { track } from "@/lib/track";
import { coordParam } from "@/lib/geo";
import { HeaderMark } from "@/components/HeaderMark";
import { TipJar } from "@/components/TipJar";
import { AlertBanner } from "@/components/AlertBanner";
import { DEFAULT_DEST, DEFAULT_ORIGIN, canonicalDir } from "@/lib/places";

const LS_KEY = "bw.route.v1";
const DIR_KEY = "bw.dir.v1";

type Route = { origin: Place; dest: Place };
type Direction = "out" | "back";

// Until someone saves their own route, show the canonical Surf City <-> Hampstead
// crossing: it is the route the cron measures, so first-time visitors get real
// numbers instead of a setup screen.
const DEFAULT_ROUTE: Route = { origin: DEFAULT_ORIGIN, dest: DEFAULT_DEST };

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
  "animate-fade-up rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(2,6,23,0.04),0_16px_40px_-24px_rgba(2,6,23,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]";

const PILL_BTN =
  "pressable inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-white px-4 py-2 text-[13px] font-semibold text-sky-700 shadow-sm transition-colors hover:border-sky-300 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-400 dark:hover:border-sky-500/50";

// Unified small-caps card label, matching the hero's "Leave now".
const LABEL = "text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400";

export default function Page() {
  const [route, setRoute] = useState<Route | null>(null);
  const [direction, setDirection] = useState<Direction>("out");
  const [editing, setEditing] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");
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
    // PWA shortcuts deep-link straight into a direction (/?dir=back);
    // otherwise reopen on the direction used last time.
    try {
      const q = new URLSearchParams(window.location.search).get("dir");
      if (q === "back" || q === "out") setDirection(q);
      else if (localStorage.getItem(DIR_KEY) === "back") setDirection("back");
    } catch {
      /* ignore */
    }
    setStandalone(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    setHydrated(true);
  }, []);

  // Bridge conditions (cam, weather, tides, incidents) are route-independent: always load.
  const fetchConditions = useCallback(async () => {
    lastFetchRef.current = Date.now();
    try {
      const r = await fetch("/api/conditions", { cache: "no-store" });
      if (r.ok) {
        if (r.headers.get("x-sw-cached-at")) setOffline(true);
        setConditions((await r.json()) as ConditionsData);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetchConditions();
    // Hidden tabs keep their timers running for days; the visibilitychange
    // handler below refreshes on return, so skip polls nobody is looking at.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchConditions();
    }, 300_000);
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
      const res = await fetch(`/api/forecast?o=${coordParam(from)}&d=${coordParam(to)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("forecast");
      // The service worker answers from cache when the network fails and stamps
      // the copy; show its real age and the offline pill, never "updated now".
      const cachedAt = Number(res.headers.get("x-sw-cached-at")) || 0;
      setForecast((await res.json()) as Forecast);
      setUpdatedAt(cachedAt ? new Date(cachedAt) : new Date());
      setOffline(cachedAt > 0);
    } catch {
      setError("Couldn't load traffic right now. Try refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  const active = route ?? DEFAULT_ROUTE;
  const isDefault = !route;

  useEffect(() => {
    if (hydrated) fetchForecast(active, direction);
  }, [active, direction, hydrated, fetchForecast]);

  // The default route shares one CDN entry across every visitor, so a 2-minute
  // poll is nearly free; a personal route pays Mapbox per build, so ease off.
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible") fetchForecast(active, direction);
      },
      isDefault ? 120_000 : 300_000,
    );
    return () => clearInterval(id);
  }, [active, direction, hydrated, isDefault, fetchForecast]);

  // Weekly history powers both the trip planner and the heatmap; fetch it once
  // per route + direction up here and share it.
  useEffect(() => {
    if (!hydrated) {
      setHistory(null);
      return;
    }
    const from = direction === "out" ? active.origin : active.dest;
    const to = direction === "out" ? active.dest : active.origin;
    let cancelled = false;
    setHistory(null);
    fetch(`/api/history?o=${coordParam(from)}&d=${coordParam(to)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setHistory(j as HistoryData);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, active, direction]);

  // PWAs reopen from the background a lot; refetch when the app comes back
  // (stale after 2 min) or when the connection returns.
  useEffect(() => {
    const refresh = () => {
      if (Date.now() - lastFetchRef.current < 120_000) return;
      fetchConditions();
      fetchForecast(active, direction);
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
  }, [active, direction, fetchForecast, fetchConditions]);

  // "Surf City bridge right now: 12 min, clear. Good time to go." for the share sheet.
  function liveShare(): { text: string; url: string } | undefined {
    if (!forecast || forecast.now == null) return undefined;
    const call = buildCall(forecast, conditions);
    const state = call.tone === "emerald" ? "clear" : call.tone === "amber" ? "slow" : "heavy";
    const where = isDefault ? (direction === "out" ? "Leaving Topsail" : "Heading to Topsail") : `${from.label} to ${to.label}`;
    return {
      text: `${where} right now: ${forecast.now} min across the Surf City bridge, ${state}. ${call.headline}`,
      url: `https://topsailtraffic.com/${direction === "back" ? "?dir=back" : ""}`,
    };
  }

  function chooseDirection(d: Direction) {
    track("direction", { dir: d });
    setDirection(d);
    try {
      localStorage.setItem(DIR_KEY, d);
    } catch {
      /* ignore */
    }
  }

  function applyRoute(origin: Place, dest: Place) {
    track("route_set", { canonical: canonicalDir(origin, dest) != null });
    const r = { origin, dest };
    setRoute(r);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  }

  function clearRoute() {
    setRoute(null);
    setForecast(null);
    setHistory(null);
    setError(null);
    setUpdatedAt(null);
    setDirection("out");
    setEditing(false);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }

  const from = direction === "out" ? active.origin : active.dest;
  const to = direction === "out" ? active.dest : active.origin;
  const curve = forecast ? forecast.points.flatMap((p) => (p.minutes != null ? [p.minutes] : [])) : [];
  const hasCurve = curve.length > 1;
  const flat = hasCurve && Math.max(...curve) - Math.min(...curve) < 3;

  const headerPills = (
    <>
      <button
        onClick={async () => {
          track("share", { dir: direction, live: forecast?.now != null });
          if ((await sharePage(liveShare())) === "copied") {
            setShareLabel("Copied");
            setTimeout(() => setShareLabel("Share"), 2000);
          }
        }}
        className={PILL_BTN}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m8 7 4-4 4 4" />
          <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
        </svg>
        {shareLabel}
      </button>
      {!standalone && (
        <button
          onClick={() => {
            track("install_open");
            setInstallOpen(true);
          }}
          className={PILL_BTN}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <rect x="6.5" y="2.5" width="11" height="19" rx="3" />
            <path d="M10.5 18.5h3" />
          </svg>
          Get the app
        </button>
      )}
    </>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:py-12 xl:max-w-6xl">
      <header className="mb-5 animate-fade-up">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <HeaderMark />
            <h1 className="truncate font-serif text-4xl tracking-tight md:text-5xl">Topsail Traffic</h1>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{headerPills}</div>
        </div>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          When to leave (and return to) Topsail Island.
        </p>
        <div className="mt-2.5 flex items-center gap-2 sm:hidden">{headerPills}</div>
      </header>

      {/* Route control */}
      <div className="mb-5 animate-fade-up space-y-3 lg:flex lg:items-center lg:gap-4 lg:space-y-0">
        <button
          onClick={() => setEditing(true)}
          className="pressable flex w-full items-center lg:flex-1 gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(2,6,23,0.04),0_12px_32px_-24px_rgba(2,6,23,0.25)] transition-colors hover:border-sky-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-sky-700"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">
              {isDefault ? "The bridge crossing" : "Your route"}
            </span>
            <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
              {isDefault
                ? direction === "out"
                  ? "Surf City → Hampstead"
                  : "Hampstead → Surf City"
                : `${from.label} → ${to.label}`}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-sky-600 dark:text-sky-400">
            {isDefault ? "Change" : "Edit"}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:max-w-md lg:shrink-0">
          <div className="relative inline-grid grid-cols-2 rounded-full border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(2,6,23,0.04)] dark:border-white/10 dark:bg-slate-900">
            <span
              aria-hidden
              className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-sky-600 shadow-sm transition-transform duration-300 ease-out ${
                direction === "back" ? "translate-x-full" : ""
              }`}
            />
            {(["out", "back"] as Direction[]).map((dval) => (
              <button
                key={dval}
                onClick={() => chooseDirection(dval)}
                aria-pressed={direction === dval}
                className={`relative z-10 rounded-full px-4 py-1.5 font-medium transition-colors duration-300 ${
                  direction === dval
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {isDefault ? (dval === "out" ? "Off the island" : "To the island") : dval === "out" ? "Leaving" : "Returning"}
              </button>
            ))}
          </div>
          {isDefault && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Surf City to Hampstead, the crossing we measure.{" "}
              <button onClick={() => setEditing(true)} className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
                Set your own route
              </button>{" "}
              for door-to-door times.
            </p>
          )}
        </div>
      </div>

      <AlertBanner data={conditions} />

      {error && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          {/* The decision (verdict + next 3 hours) stays in view on desktop while
              the cams and planning tools scroll beside it. */}
          <div className="space-y-5 lg:sticky lg:top-6">
            <Hero forecast={forecast} conditions={conditions} loading={loading} />
            {hasCurve && forecast && (
              <section className={CARD} style={{ animationDelay: "120ms" }}>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className={LABEL}>Next 3 hours</h2>
                  {!flat && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> best window
                    </span>
                  )}
                </div>
                <ForecastChart forecast={forecast} />
              </section>
            )}
          </div>

          <div className="space-y-5">
            <section className={CARD} style={{ animationDelay: "100ms" }}>
              <Conditions data={conditions} />
            </section>
            <section className={CARD} style={{ animationDelay: "140ms" }}>
              <TripPlanner data={history} dir={direction} onDirChange={chooseDirection} />
            </section>
            <section className={CARD} style={{ animationDelay: "180ms" }}>
              <Heatmap data={history} dir={direction} />
            </section>
            <section className={CARD} style={{ animationDelay: "200ms" }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={LABEL}>The route</h2>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> bridge
                </span>
              </div>
              <RouteMap origin={from} dest={to} />
            </section>
          </div>
        </div>

      <section className="mt-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <button
          onClick={() => {
            fetchForecast(active, direction);
            fetchConditions();
          }}
          className="hover:text-slate-600 dark:hover:text-slate-200"
        >
          ↻ Refresh
        </button>
        <span>
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </span>
      </section>
      <div className="mt-6 animate-fade-up">
        <TipJar source="home" />
      </div>

      {offline && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-40 flex justify-center md:bottom-5">
          <span className="rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur dark:bg-white/90 dark:text-slate-900">
            Offline · data from{" "}
            {updatedAt ? updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "earlier"}
          </span>
        </div>
      )}

      <RouteEditor
        open={editing}
        origin={route?.origin ?? null}
        dest={route?.dest ?? null}
        onApply={applyRoute}
        onClear={route ? clearRoute : undefined}
        onClose={() => setEditing(false)}
      />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </main>
  );
}
