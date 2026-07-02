"use client";

import { useEffect, useRef, useState } from "react";

const ISLAND_HLS = "https://www.surfchex.com/hls/sciga/index.m3u8";
// NCDOT serves this exact PNG (constant size) when a camera is temporarily down.
const PLACEHOLDER_BYTES = 15136;

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
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // The feed comes and goes at Surfchex's end; recheck every few minutes so
  // the view recovers mid-session instead of waiting for a reload.
  useEffect(() => {
    if (!failed) return;
    const id = setTimeout(() => {
      setFailed(false);
      setAttempt((a) => a + 1);
    }, 180_000);
    return () => clearTimeout(id);
  }, [failed]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: { destroy: () => void } | undefined;
    const tryPlay = () => video.play().catch(() => setPaused(true));

    import("hls.js")
      .then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const inst = new Hls({ liveSyncDurationCount: 3 });
          hls = inst;
          inst.loadSource(ISLAND_HLS);
          inst.attachMedia(video);
          inst.on(Hls.Events.MANIFEST_PARSED, tryPlay);
          inst.on(Hls.Events.ERROR, (_e, d) => {
            if (d?.fatal) setFailed(true);
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = ISLAND_HLS;
          video.addEventListener("loadedmetadata", tryPlay, { once: true });
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));

    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      hls?.destroy();
    };
  }, [attempt]);

  if (failed) {
    return (
      <CamPlaceholder
        title="Camera is down right now"
        subtitle="Rechecking automatically every few minutes"
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
        loop
        className="aspect-video w-full object-cover"
        onClick={() => ref.current?.play()}
      />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        LIVE
      </span>
      {paused && (
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
