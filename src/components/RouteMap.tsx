"use client";

import { useEffect, useState } from "react";
import type { LngLat } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
// The Surf City high-rise bridge roundabout: the route's bottleneck.
const BRIDGE = { lng: -77.5463, lat: 34.4285 };

export function RouteMap({ origin, dest }: { origin: LngLat; dest: LngLat }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    (async () => {
      if (!TOKEN) {
        setFailed(true);
        return;
      }
      try {
        const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
        const r = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=polyline&overview=full&access_token=${TOKEN}`,
        );
        const poly = (await r.json())?.routes?.[0]?.geometry as string | undefined;
        if (!poly) {
          setFailed(true);
          return;
        }
        const style = dark ? "dark-v11" : "light-v11";
        const path = `path-5+0ea5e9-0.9(${encodeURIComponent(poly)})`;
        const pins = [
          `pin-s+1e293b(${origin.lng},${origin.lat})`,
          `pin-l+ef4444(${BRIDGE.lng},${BRIDGE.lat})`,
          `pin-s+16a34a(${dest.lng},${dest.lat})`,
        ].join(",");
        const u = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${path},${pins}/auto/640x320@2x?padding=44&access_token=${TOKEN}`;
        if (!cancelled) setUrl(u);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, dest]);

  if (failed) return null;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Driving route over the Surf City bridge"
      className="aspect-[2/1] w-full rounded-2xl object-cover"
    />
  ) : (
    <div className="aspect-[2/1] w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
  );
}
