"use client";

import { useEffect, useState } from "react";
import type { LngLat } from "@/lib/types";

// Image is served by /api/staticmap so the Mapbox token stays server-side.
// The route is drawn with live congestion overlays; refresh on the same
// ~2 minute rhythm as the forecast.
export function RouteMap({ origin, dest }: { origin: LngLat; dest: LngLat }) {
  const [dark, setDark] = useState(false);
  const [tick, setTick] = useState(0);
  const [mapsHref, setMapsHref] = useState<string | null>(null);

  useEffect(() => {
    setDark(!!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    setTick(Math.floor(Date.now() / 120_000));
    const id = setInterval(() => setTick(Math.floor(Date.now() / 120_000)), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    setMapsHref(
      apple
        ? `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${dest.lat},${dest.lng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`,
    );
  }, [origin, dest]);

  const src = `/api/staticmap?o=${origin.lng},${origin.lat}&d=${dest.lng},${dest.lat}${dark ? "&dark=1" : ""}${
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
