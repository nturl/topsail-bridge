"use client";

import { useEffect, useState } from "react";
import type { LngLat } from "@/lib/types";

// Image is served by /api/staticmap so the Mapbox token stays server-side.
export function RouteMap({ origin, dest }: { origin: LngLat; dest: LngLat }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(!!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  }, []);

  const src = `/api/staticmap?o=${origin.lng},${origin.lat}&d=${dest.lng},${dest.lat}${dark ? "&dark=1" : ""}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Driving route over the Surf City bridge"
      className="aspect-[2/1] w-full rounded-2xl bg-slate-100 object-cover dark:bg-slate-800"
    />
  );
}
