import type { Place } from "./types";

// Defaults. Both are editable in the UI and persisted to localStorage.
export const DEFAULT_ORIGIN: Place = {
  label: "Home",
  address: "718 N Anderson Blvd, Topsail Beach, NC 28445",
  lng: -77.60552,
  lat: 34.38541,
};

export const DEFAULT_DEST: Place = {
  label: "Harris Teeter (Hampstead)",
  address: "203 Alston Blvd, Hampstead, NC 28443",
  lng: -77.605212,
  lat: 34.450868,
};
