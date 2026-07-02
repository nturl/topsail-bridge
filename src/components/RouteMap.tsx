"use client";

import { useEffect, useState } from "react";
import type { LngLat } from "@/lib/types";
import { coordParam } from "@/lib/geo";

// Image is served by /api/staticmap so the Mapbox token stays server-side.
// The map is the illustration — a ~10 minute refresh is plenty, and hidden
// tabs don't refresh at all (they catch up the moment they're visible again).
const MAP_WINDOW_MS = 600_000;

export function RouteMap({ origin, dest }: { origin: LngLat; dest: LngLat }) {
  const [dark, setDark] = useState(false);
  const [tick, setTick] = useState(0);
  const [mapsHref, setMapsHref] = useState<string | null>(null);

  useEffect(() => {
    setDark(!!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    const update = () => setTick(Math.floor(Date.now() / MAP_WINDOW_MS));
    update();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    setMapsHref(
      apple
        ? `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${dest.lat},${dest.lng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`,
    );
  }, [origin, dest]);

  const src = `/api/staticmap?o=${coordParam(origin)}&d=${coordParam(dest)}${dark ? "&dark=1" : ""}${
    tick ? `&t=${tick}` : ""
  }`;

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Driving route over the Surf City bridge, with live traffic shown in amber and red"
        className="aspect-[2/1] w-full rounded-2xl bg-slate-100 object-cover dark:bg-slate-800"
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Slow traffic shows amber and red on the route.</span>
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sky-700 hover:underline dark:text-sky-400"
          >
            Open in Maps ↗
          </a>
        )}
      </div>
    </div>
  );
}
