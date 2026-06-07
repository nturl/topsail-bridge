"use client";

import { useEffect, useRef, useState } from "react";

// Live HLS stream of the Surf City bridge (hosted by Surf City IGA).
const SRC = "https://www.surfchex.com/hls/sciga/index.m3u8";

export function BridgeCam() {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: { destroy: () => void } | undefined;
    const tryPlay = () => {
      video.play().catch(() => setPaused(true));
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS play HLS natively.
      video.src = SRC;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (!Hls.isSupported()) {
            setFailed(true);
            return;
          }
          const instance = new Hls({ liveSyncDurationCount: 3 });
          hls = instance;
          instance.loadSource(SRC);
          instance.attachMedia(video);
          instance.on(Hls.Events.MANIFEST_PARSED, tryPlay);
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data?.fatal) setFailed(true);
          });
        })
        .catch(() => setFailed(true));
    }

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
        Open live bridge cam ↗
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
        LIVE · Surf City bridge
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
