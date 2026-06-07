import type { LngLat, Place } from "./types";

// Neutral default for new visitors: Surf City, the middle of the island at the
// bridge. Everyone personalizes their own route (saved per device). This is also
// the "canonical" route the cron logs real measured data for.
export const DEFAULT_ORIGIN: Place = {
  label: "Surf City",
  address: "Surf City, NC",
  lng: -77.545585,
  lat: 34.427278,
};

export const DEFAULT_DEST: Place = {
  label: "Harris Teeter (Hampstead)",
  address: "203 Alston Blvd, Hampstead, NC 28443",
  lng: -77.605212,
  lat: 34.450868,
};

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

// Which canonical orientation (if any) a route matches, so we can overlay the
// measured cron data for it. Returns null for personalized routes.
export function canonicalDir(o: LngLat, d: LngLat): "out" | "back" | null {
  const isOrigin = (p: LngLat) => near(p.lng, DEFAULT_ORIGIN.lng) && near(p.lat, DEFAULT_ORIGIN.lat);
  const isDest = (p: LngLat) => near(p.lng, DEFAULT_DEST.lng) && near(p.lat, DEFAULT_DEST.lat);
  if (isOrigin(o) && isDest(d)) return "out";
  if (isDest(o) && isOrigin(d)) return "back";
  return null;
}
