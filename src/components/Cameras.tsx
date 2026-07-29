"use client";

import type Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

const ISLAND_HLS = "https://www.surfchex.com/hls/sciga/index.m3u8";
// NCDOT serves this exact PNG (constant size) when a camera is temporarily down.
const PLACEHOLDER_BYTES = 15136;

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

const TABS = [
  { key: "island", label: "Island", caption: "Live: Surf City roundabout, island side." },
  { key: "mainland", label: "NC-210", caption: "NC-210 approach on the mainland, via NCDOT." },
  { key: "us17", label: "US-17", caption: "US-17 at Scotts Hill — the approach from Wilmington, via NCDOT." },
  { key: "porters", label: "Porters Neck", caption: "US-17 (Market St) at Porters Neck — where Wilmington-side backups start, via DriveNC." },
  { key: "i40", label: "I-40", caption: "I-40 Exit 408 at NC-210 — the approach from Raleigh, via NCDOT." },
] as const;
type CamKey = (typeof TABS)[number]["key"];

// Snapshots come through /api/cam (server-side proxy) because NCDOT's CORS
// headers are malformed for direct browser fetches; the DriveNC link is the
// upstream source for humans.
const NCDOT: Record<Exclude<CamKey, "island">, { id: string; alt: string; offlineSubtitle: string }> = {
  mainland: {
    id: "5400",
    alt: "NC-210 mainland approach to the Surf City bridge",
    offlineSubtitle: "NC-210 mainland feed",
  },
  us17: {
    id: "6043",
    alt: "US-17 at Scotts Hill, the approach to Topsail Island from Wilmington",
    offlineSubtitle: "US-17 Scotts Hill feed",
  },
  porters: {
    id: "4781",
    alt: "US-17 Market Street at Porters Neck, where Wilmington-side congestion begins",
    offlineSubtitle: "US-17 Porters Neck feed",
  },
  i40: {
    id: "6116",
    alt: "I-40 Exit 408 at NC-210, the approach to Topsail Island from Raleigh",
    offlineSubtitle: "I-40 at NC-210 feed",
  },
};

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

// Island roundabout: live HLS video. Prefer hls.js wherever it's supported
// (Chrome/Edge/Firefox/Dia); only fall back to native HLS on Safari/iOS, since
// Chromium reports a misleading canPlayType("maybe") it can't actually decode.
function IslandVideo() {
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
          inst.loadSource(ISLAND_HLS);
          inst.attachMedia(video);
          inst.on(HlsCtor.Events.MANIFEST_PARSED, tryPlay);
          // Surfchex hotlink-protects this feed by referer: off-site players get
          // a finite VOD loop of their promo slate instead of the camera. It
          // decodes perfectly, so only the playlist shape gives it away.
          inst.on(HlsCtor.Events.LEVEL_LOADED, (_e, d) => {
            if (!d.details.live) blocked();
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
          video.src = ISLAND_HLS;
          video.addEventListener("loadedmetadata", tryPlay, { once: true });
          // Same promo-slate check for native HLS: a live feed has no duration.
          video.addEventListener("durationchange", () => {
            if (Number.isFinite(video.duration)) blocked();
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
  }, [attempt]);

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
    return (
      <CamPlaceholder
        title="This cam only plays on Surfchex"
        subtitle="They host the Surf City bridge camera and don't allow it off their site."
        href="https://www.surfchex.com/cams/surf-city-bridge/"
        hrefLabel="Watch it on Surfchex"
      />
    );
  }

  if (status === "offline") {
    return (
      <CamPlaceholder
        title="Camera is down right now"
        subtitle="Rechecking automatically"
        href="https://www.surfchex.com/cams/surf-city-bridge/"
        hrefLabel="Open live cam"
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

// NCDOT gates its live video, but serves a public snapshot PNG per camera that
// updates ~every minute. Refresh it on an interval with a cache-bust.
function NcdotSnapshot({ cam }: { cam: (typeof NCDOT)[Exclude<CamKey, "island">] }) {
  // "loading" | "offline" (cam down / NCDOT placeholder) | { url } (live frame)
  const [state, setState] = useState<"loading" | "offline" | { url: string }>("loading");

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setState("loading");
    const load = async () => {
      try {
        const r = await fetch(`/api/cam?id=${cam.id}&t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) {
          if (alive) setState("offline");
          return;
        }
        const blob = await r.blob();
        if (!alive) return;
        if (blob.size === PLACEHOLDER_BYTES) {
          setState("offline"); // NCDOT's "no live camera feed" graphic
          return;
        }
        if (objUrl) URL.revokeObjectURL(objUrl);
        objUrl = URL.createObjectURL(blob);
        setState({ url: objUrl });
      } catch {
        if (alive) setState("offline");
      }
    };
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [cam]);

  if (state === "loading") {
    return <CamPlaceholder pulse subtitle="Loading camera view…" />;
  }
  if (state === "offline") {
    return (
      <CamPlaceholder
        title="Camera is down right now"
        subtitle={cam.offlineSubtitle}
        href={`https://www.drivenc.gov/map/Cctv/${cam.id}`}
        hrefLabel="Check on DriveNC"
      />
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.url} alt={cam.alt} className="aspect-video w-full object-cover" />
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        NCDOT · refreshes ~1 min
      </span>
    </div>
  );
}

export function Cameras() {
  const [view, setView] = useState<CamKey>("island");
  const tab = "pressable shrink-0 rounded-full px-3 py-1 transition-colors";
  const active = "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white";
  const idle = "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";
  const current = TABS.find((t) => t.key === view) ?? TABS[0];

  return (
    <div>
      <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-full bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} className={`${tab} ${view === t.key ? active : idle}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === "island" ? <IslandVideo /> : <NcdotSnapshot cam={NCDOT[view]} />}

      <p className="mt-2 text-xs text-slate-400">{current.caption}</p>
    </div>
  );
}
