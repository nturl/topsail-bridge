import type { Place } from "./types";

// Defaults. Both are editable in the UI and persisted to localStorage.
export const DEFAULT_ORIGIN: Place = {
  label: "Topsail Beach",
  address: "Topsail Beach, NC",
  lng: -77.628865,
  lat: 34.366405,
};

export const DEFAULT_DEST: Place = {
  label: "Harris Teeter (Hampstead)",
  address: "203 Alston Blvd, Hampstead, NC 28443",
  lng: -77.605212,
  lat: 34.450868,
};
