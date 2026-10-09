"use client";

import type Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ISLAND_CAMERA_MODE, ISLAND_HLS } from "@/lib/camera-config";
import { NCDOT_CAMS, isPlaceholder, type NcdotCam } from "@/lib/cams";

// This feed's usual failure is silent, not loud: the player stays "playing"
// while the picture freezes, or it drifts minutes behind the live edge and
// replays buffered frames under a LIVE badge. hls.js reports no error for
// either. Surfchex's own player polls for real playback progress instead of
// trusting events; these thresholds mirror theirs.
const STARTUP_TIMEOUT_MS = 20_000;
const WATCHDOG_INTERVAL_MS = 3_000;
const STALL_HEAL_MS = 6_000; // no progress this long -> nudge the loader
const STALL_REBUILD_MS = 30_000; // still frozen -> tear the player down
const HEAL_COOLDOWN_MS = 15_000;
const REBUILD_COOLDOWN_MS = 45_000;
const MAX_DRIFT_S = 20; // this far behind the live edge -> seek forward
const RETRY_BACKOFF_MS = [8_000, 20_000, 60_000];

type CamKey = (typeof NCDOT_CAMS)[number]["key"] | "island";

const ISLAND_CAPTION = "Surf City roundabout, island side, hosted by Surfchex.";
const DRIVENC = "https://www.drivenc.gov/";

// Topsail Island oval, recreated in the generic regional-sticker style (initials
// + place name in an oval) rather than copying any specific brand's logo.
function TopsailOval() {
  return (
    <div
      className="flex flex-col items-center justify-center bg-white shadow"
      style={{ width: 152, height: 94, borderRadius: "50%", border: "5px solid #0f172a" }}
    >
      <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: 1, color: "#0f172a" }}>TI</span>
      <span className="font-serif italic" style={{ fontSize: 12, marginTop: 3, color: "#0f172a" }}>
        Topsail Island, NC
      </span>
    </div>
  );
}

// On-brand fallback shown whenever a feed isn't live: the Topsail Island oval on
// the app's coastal gradient, instead of a black box or NCDOT's graphic.
function CamPlaceholder({
  title,
  subtitle,
  href,
  hrefLabel,
  pulse,
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  pulse?: boolean;
}) {
  return (
    <div
      className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 text-center"
      style={{ background: "linear-gradient(160deg,#38bdf8,#0369a1)" }}
    >
      <div className={pulse ? "animate-pulse" : ""}>
        <TopsailOval />
      </div>
      {title && <p className="mt-1 text-sm font-medium text-white">{title}</p>}
      {subtitle && <p className="text-xs text-white/75">{subtitle}</p>}
      {href && hrefLabel && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 text-xs text-white underline underline-offset-4 hover:opacity-80"
        >
          {hrefLabel} ↗
        </a>
      )}
    </div>
  );
}

function SurfchexLink() {
  return (
    <CamPlaceholder
      title="Live Surf City Bridge camera"
      subtitle="Hosted by Surf City IGA via Surfchex"
      href="https://www.surfchex.com/cams/surf-city-bridge/"
      hrefLabel="Open live camera on Surfchex"
    />
  );
}

// Island roundabout: live HLS video. Prefer hls.js wherever it's supported
// (Chrome/Edge/Firefox/Dia); only fall back to native HLS on Safari/iOS, since
// Chromium reports a misleading canPlayType("maybe") it can't actually decode.
function IslandVideo({ src, isSurfchex }: { src: string; isSurfchex: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  // "starting" until frames actually move; "live" only while they keep moving.
  const [status, setStatus] = useState<"starting" | "live" | "offline" | "blocked">("starting");
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const hls = useRef<Hls | null>(null);
  const statusRef = useRef(status);
  const lastTime = useRef(0);
  const lastProgressAt = useRef(0);
  const lastHealAt = useRef(0);
  const lastRebuildAt = useRef(0);
  const retries = useRef(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const rebuild = useCallback(() => {
    lastRebuildAt.current = Date.now();
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let started = false;
    let inst: Hls | null = null;

    const tryPlay = () => void video.play().catch(() => setPaused(true));
    const fail = () => {
      if (!cancelled) setStatus("offline");
    };
    // Terminal: the promo slate buffers like any other video, so "loadeddata"
    // lands after we've already identified it and would flip us back to live.
    let isBlocked = false;
    const blocked = () => {
      isBlocked = true;
      if (!cancelled) setStatus("blocked");
    };

    // A feed that never produces a frame looks identical to one still loading.
    const startupTimer = setTimeout(() => {
      if (!started) fail();
    }, STARTUP_TIMEOUT_MS);

    // "live" means the feed is reachable and decoding, not that it's playing:
    // a browser blocking muted autoplay is a play-button case, not an outage.
    const onReady = () => {
      if (isBlocked) return;
      started = true;
      retries.current = 0;
      lastTime.current = video.currentTime;
      lastProgressAt.current = Date.now();
      setStatus("live");
    };
    const onPlaying = () => {
      onReady();
      setPaused(false);
    };
    const onPause = () => setPaused(true);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);

    import("hls.js")
      .then(({ default: HlsCtor }) => {
        if (cancelled) return;
        if (HlsCtor.isSupported()) {
          inst = new HlsCtor({
            liveDurationInfinity: true,
            maxMaxBufferLength: 30,
            manifestLoadingTimeOut: 10_000,
            manifestLoadingMaxRetry: 4,
            levelLoadingTimeOut: 10_000,
            levelLoadingMaxRetry: 6,
            fragLoadingMaxRetry: 6,
          });
          hls.current = inst;
          inst.loadSource(src);
          inst.attachMedia(video);
          inst.on(HlsCtor.Events.MANIFEST_PARSED, tryPlay);
          // Surfchex hotlink-protects this feed by referer: off-site players get
          // a finite VOD loop of their promo slate instead of the camera. It
          // decodes perfectly, so only the playlist shape gives it away.
          inst.on(HlsCtor.Events.LEVEL_LOADED, (_e, d) => {
            if (!d.details.live) {
              if (isSurfchex) blocked();
              else fail();
            }
          });
          inst.on(HlsCtor.Events.ERROR, (_e, d) => {
            if (!d.fatal) return;
            // Most fatal network/media errors recover in place. Only a dead
            // manifest means the feed itself is gone.
            const deadManifest =
              d.details === HlsCtor.ErrorDetails.MANIFEST_LOAD_ERROR ||
              d.details === HlsCtor.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
            if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR && !deadManifest) inst?.startLoad();
            else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) inst?.recoverMediaError();
            else fail();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.addEventListener("loadedmetadata", tryPlay, { once: true });
          // Same promo-slate check for native HLS: a live feed has no duration.
          video.addEventListener("durationchange", () => {
            if (Number.isFinite(video.duration)) {
              if (isSurfchex) blocked();
              else fail();
            }
          });
          video.onerror = fail;
        } else {
          fail();
        }
      })
      .catch(fail);

    return () => {
      cancelled = true;
      clearTimeout(startupTimer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.onerror = null;
      inst?.destroy();
      hls.current = null;
    };
  }, [attempt, isSurfchex, src]);

  // Watchdog: poll for real progress, since a frozen or stale feed fires no events.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const seekToLiveEdge = () => {
      const s = video.seekable;
      if (!s.length) return;
      const edge = s.end(s.length - 1);
      if (edge - video.currentTime > MAX_DRIFT_S) video.currentTime = Math.max(edge - 2, 0);
    };

    const heal = () => {
      lastHealAt.current = Date.now();
      hls.current?.startLoad();
      seekToLiveEdge();
      void video.play().catch(() => setPaused(true));
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (statusRef.current !== "live" || video.paused) return;
      const now = Date.now();
      if (Math.abs(video.currentTime - lastTime.current) > 0.25) {
        lastTime.current = video.currentTime;
        lastProgressAt.current = now;
        seekToLiveEdge();
        return;
      }
      const frozenFor = now - lastProgressAt.current;
      if (frozenFor > STALL_REBUILD_MS && now - lastRebuildAt.current > REBUILD_COOLDOWN_MS) rebuild();
      else if (frozenFor > STALL_HEAL_MS && now - lastHealAt.current > HEAL_COOLDOWN_MS) heal();
    };

    // Backgrounded tabs get throttled and come back arbitrarily far behind.
    const onReturn = () => {
      if (document.visibilityState !== "visible" || statusRef.current !== "live") return;
      lastTime.current = video.currentTime;
      lastProgressAt.current = Date.now();
      if (video.error || video.readyState === 0) rebuild();
      else heal();
    };

    const id = setInterval(tick, WATCHDOG_INTERVAL_MS);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [rebuild]);

  // Once down, retry on a widening backoff rather than a flat interval.
  useEffect(() => {
    if (status !== "offline") return;
    const id = setTimeout(
      () => {
        retries.current += 1;
        setStatus("starting");
        setAttempt((a) => a + 1);
      },
      RETRY_BACKOFF_MS[Math.min(retries.current, RETRY_BACKOFF_MS.length - 1)],
    );
    return () => clearTimeout(id);
  }, [status]);

  // Not an outage: Surfchex serves their promo slate to off-site players, so
  // retrying won't help. Send people to the source instead of looping their ad.
  if (status === "blocked") {
    return <SurfchexLink />;
  }

  if (status === "offline") {
    return (
      <CamPlaceholder
        title="Camera is down right now"
        subtitle="Rechecking automatically"
        href={isSurfchex ? "https://www.surfchex.com/cams/surf-city-bridge/" : undefined}
        hrefLabel={isSurfchex ? "Open live cam" : undefined}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      <video
        ref={ref}
        muted
        autoPlay
        playsInline
        className="aspect-video w-full object-cover"
        onClick={() => ref.current?.play()}
      />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        {status === "live" && !paused ? (
          <>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            LIVE
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            CONNECTING
          </>
        )}
      </span>
      {paused && status === "live" && (
        <button
          type="button"
          onClick={() => ref.current?.play()}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          aria-label="Play live camera"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 pl-1 text-xl text-slate-900">
            ▶
          </span>
        </button>
      )}
    </div>
  );
}


// "5:41p", matching the conditions chips.
function shortClock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(/\s?([ap])m/, "$1");
}

// NCDOT gates its live video, but serves a public snapshot per camera that
// updates about once a minute. Ask on a 30-second bucket so the CDN shares
// each frame across visitors instead of fetching one per person.
type Snap = "loading" | "offline" | { url: string; at: Date };

function useSnapshot(id: string): Snap {
  const [state, setState] = useState<Snap>("loading");

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setState("loading");
    // A failed refresh keeps the last good frame for a few minutes (its
    // timestamp shows its age) rather than flashing the "down" card.
    const fail = () =>
      setState((prev) => (typeof prev === "object" && Date.now() - prev.at.getTime() < 300_000 ? prev : "offline"));
    const load = async () => {
      try {
        const r = await fetch(`/api/cam?id=${id}&t=${Math.floor(Date.now() / 30_000)}`);
        if (!alive) return;
        if (!r.ok) return fail();
        const blob = await r.blob();
        if (!alive) return;
        if (isPlaceholder(blob.size)) {
          setState("offline");
          return;
        }
        const next = URL.createObjectURL(blob);
        if (objUrl) URL.revokeObjectURL(objUrl);
        objUrl = next;
        setState({ url: next, at: new Date() });
      } catch {
        if (alive) fail();
      }
    };
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [id]);

  return state;
}

// Which cameras are showing a picture right now (null until known).
function useCamStatus(): Record<string, boolean> | null {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/cams")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { cams?: { id: string; live: boolean }[] } | null) => {
          if (alive && j?.cams) setStatus(Object.fromEntries(j.cams.map((c) => [c.id, c.live])));
        })
        .catch(() => {});
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return status;
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close camera view"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl text-white backdrop-blur"
      >
        ×
      </button>
    </div>
  );
}

function NcdotSnapshot({ cam, fallback }: { cam: NcdotCam; fallback?: { label: string; onClick: () => void } }) {
  const state = useSnapshot(cam.id);
  const [zoom, setZoom] = useState(false);
  const close = useCallback(() => setZoom(false), []);

  if (state === "loading") {
    return <CamPlaceholder pulse subtitle="Loading camera view…" />;
  }
  if (state === "offline") {
    return (
      <div className="relative">
        <CamPlaceholder title="Camera is down right now" subtitle={`${cam.label} feed · NCDOT`} />
        {fallback && (
          <button
            type="button"
            onClick={fallback.onClick}
            className="pressable absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-sky-800 shadow-lg"
          >
            Show {fallback.label} instead
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block w-full cursor-zoom-in"
        aria-label={`Enlarge the ${cam.label} camera`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.url} alt={cam.alt} className="aspect-video w-full object-cover" />
      </button>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        NCDOT · {shortClock(state.at)}
      </span>
      <a
        href={DRIVENC}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur hover:bg-black/70"
      >
        Live video on DriveNC ↗
      </a>
      {zoom && <Lightbox src={state.url} alt={cam.alt} onClose={close} />}
    </div>
  );
}

function IslandView() {
  return ISLAND_CAMERA_MODE !== "link" ? (
    <IslandVideo src={ISLAND_HLS} isSurfchex={ISLAND_CAMERA_MODE === "surfchex"} />
  ) : (
    <SurfchexLink />
  );
}

export function Cameras() {
  const status = useCamStatus();
  const [view, setView] = useState<CamKey>(NCDOT_CAMS[0].key);
  const userPicked = useRef(false);

  // Open on the nearest camera that is actually showing a picture, unless the
  // visitor has already picked one.
  useEffect(() => {
    if (!status || userPicked.current) return;
    const firstLive = NCDOT_CAMS.find((c) => status[c.id]);
    if (firstLive) setView(firstLive.key);
  }, [status]);

  const choose = (k: CamKey) => {
    userPicked.current = true;
    setView(k);
  };

  const cam = NCDOT_CAMS.find((c) => c.key === view);
  const nextLive = NCDOT_CAMS.find((c) => c.key !== view && status?.[c.id]);
  const tabs = [
    ...NCDOT_CAMS.map((c) => ({ key: c.key as CamKey, label: c.label, live: status ? status[c.id] : undefined })),
    { key: "island" as CamKey, label: "Island", live: undefined },
  ];
  const caption = cam
    ? cam.caption
    : ISLAND_CAMERA_MODE === "authorized"
      ? "Live authorized island camera."
      : ISLAND_CAPTION;

  return (
    <div>
      <div role="group" aria-label="Traffic camera view" className="mb-3 flex flex-wrap gap-1.5 text-xs font-medium">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={view === t.key}
            aria-label={t.live === false ? `${t.label} (camera down)` : t.label}
            onClick={() => choose(t.key)}
            className={`pressable inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
              view === t.key
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {t.live !== undefined && (
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${t.live ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {cam ? (
        <NcdotSnapshot
          key={cam.id}
          cam={cam}
          fallback={nextLive ? { label: nextLive.label, onClick: () => choose(nextLive.key) } : undefined}
        />
      ) : (
        <IslandView />
      )}

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {caption}
        {cam && (
          <>
            {" "}
            Camera:{" "}
            <a href={DRIVENC} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              NCDOT via DriveNC
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}

// Every camera at once, for /cams.
export function CameraGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {NCDOT_CAMS.map((c) => (
        <figure key={c.id}>
          <NcdotSnapshot cam={c} />
          <figcaption className="mt-2 text-sm leading-snug">
            <span className="font-medium text-slate-800 dark:text-slate-100">{c.label}.</span>{" "}
            <span className="text-slate-500 dark:text-slate-400">{c.caption}</span>
          </figcaption>
        </figure>
      ))}
      <figure>
        <IslandView />
        <figcaption className="mt-2 text-sm leading-snug">
          <span className="font-medium text-slate-800 dark:text-slate-100">Island.</span>{" "}
          <span className="text-slate-500 dark:text-slate-400">{ISLAND_CAPTION}</span>
        </figcaption>
      </figure>
    </div>
  );
}
