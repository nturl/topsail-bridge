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

// One-tap presets for the route editor, hard-coded so a tap never costs a
// geocode call. Town centers are OpenStreetMap place relations (Nominatim,
// checked 2026-10-09) and agree with the 2024 Census Gazetteer to within a few
// km; the island points reverse-geocode to island roads. Surf City and
// Hampstead reuse the canonical points, so picking both shows measured data.
// Every point sits inside the service box in geo.ts.
export const ISLAND_PRESETS: Place[] = [
  { ...DEFAULT_ORIGIN },
  { label: "Topsail Beach", address: "Topsail Beach, NC", lng: -77.630529, lat: 34.365169 },
  { label: "North Topsail Beach", address: "North Topsail Beach, NC", lng: -77.458066, lat: 34.475137 },
];

export const MAINLAND_PRESETS: Place[] = [
  { label: "Hampstead", address: "Harris Teeter, 203 Alston Blvd, Hampstead, NC", lng: DEFAULT_DEST.lng, lat: DEFAULT_DEST.lat },
  { label: "Holly Ridge", address: "Holly Ridge, NC", lng: -77.55497, lat: 34.495445 },
  { label: "Sneads Ferry", address: "Sneads Ferry, NC", lng: -77.38005, lat: 34.557597 },
  { label: "Wilmington", address: "Wilmington, NC", lng: -77.948728, lat: 34.235285 },
  { label: "Jacksonville", address: "Jacksonville, NC", lng: -77.430983, lat: 34.750996 },
  { label: "Raleigh", address: "Raleigh, NC", lng: -78.639099, lat: 35.780398 },
  { label: "Charlotte", address: "Charlotte, NC", lng: -80.843083, lat: 35.227209 },
];
