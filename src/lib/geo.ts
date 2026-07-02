import type { LngLat } from "./types";

// Coordinate hygiene for the Mapbox-proxying API routes: quantize to ~11 m so
// near-identical routes (GPS jitter, repeated searches) collapse onto one
// cache key, and reject coordinates outside the service area so the routes
// can't be scripted as an open proxy against the paid Mapbox APIs.

// Generous service box: North Carolina plus day-trip origins (Charlotte,
// Raleigh, Myrtle Beach, Norfolk). Real users planning a Topsail trip fit
// inside; worldwide coordinates do not.
const SERVICE = { minLng: -84.5, maxLng: -75.0, minLat: 33.0, maxLat: 37.5 };

export function quantize(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

export function quantizePoint(p: LngLat): LngLat {
  return { lng: quantize(p.lng), lat: quantize(p.lat) };
}

export function inServiceArea(p: LngLat): boolean {
  return p.lng >= SERVICE.minLng && p.lng <= SERVICE.maxLng && p.lat >= SERVICE.minLat && p.lat <= SERVICE.maxLat;
}

// Client-side helper: a stable "lng,lat" pair for API URLs, so every client
// asking about the same spot shares one edge-cache entry.
export function coordParam(p: LngLat): string {
  return `${quantize(p.lng)},${quantize(p.lat)}`;
}
