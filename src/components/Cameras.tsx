"use client";

import { useEffect, useRef, useState } from "react";

const ISLAND_HLS = "https://www.surfchex.com/hls/sciga/index.m3u8";
const MAINLAND_IMG = "https://www.drivenc.gov/map/Cctv/5400";
// NCDOT serves this exact PNG (constant size) when a camera is temporarily down.
const PLACEHOLDER_BYTES = 15136;

// Island roundabout: live HLS video. Prefer hls.js wherever it's supported
// (Chrome/Edge/Firefox/Dia); only fall back to native HLS on Safari/iOS, since
// Chromium reports a misleading canPlayType("maybe") it can't actually decode.
function IslandVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);

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
  }, []);

  if (failed) {
    return (
      <a
        href="https://www.surfchex.com/cams/surf-city-bridge/"
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full items-center justify-center rounded-2xl bg-slate-900 text-sm text-sky-300"
      >
        Open live cam ↗
      </a>
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

// Mainland NC-210: NCDOT gates the video, but serves a public snapshot PNG that
// updates ~every minute. Refresh it on an interval with a cache-bust.
function MainlandSnapshot() {
  // "loading" | "offline" (cam down / NCDOT placeholder) | { url } (live frame)
  const [state, setState] = useState<"loading" | "offline" | { url: string }>("loading");

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    const load = async () => {
      try {
        const r = await fetch(`${MAINLAND_IMG}?t=${Date.now()}`, { cache: "no-store" });
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
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, []);

  if (state === "loading") {
    return <div className="aspect-video w-full animate-pulse rounded-2xl bg-slate-800" />;
  }
  if (state === "offline") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 text-center text-xs text-slate-400">
        <span>Mainland cam is offline right now.</span>
        <a href={MAINLAND_IMG} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
          Check on DriveNC ↗
        </a>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.url}
        alt="NC-210 mainland approach to the Surf City bridge"
        className="aspect-video w-full object-cover"
      />
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
        NCDOT · refreshes ~1 min
      </span>
    </div>
  );
}

export function Cameras() {
  const [view, setView] = useState<"island" | "mainland">("island");
  const tab = "rounded-full px-3 py-1 transition";
  const active = "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white";
  const idle = "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
        <button onClick={() => setView("island")} className={`${tab} ${view === "island" ? active : idle}`}>
          Island roundabout
        </button>
        <button onClick={() => setView("mainland")} className={`${tab} ${view === "mainland" ? active : idle}`}>
          Mainland NC-210
        </button>
      </div>

      {view === "island" ? <IslandVideo /> : <MainlandSnapshot />}

      <p className="mt-2 text-xs text-slate-400">
        {view === "island"
          ? "Live: Surf City roundabout, island side."
          : "NC-210 approach on the mainland, via NCDOT."}
      </p>
    </div>
  );
}
