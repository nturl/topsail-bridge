export type LngLat = { lng: number; lat: number };

export type Place = {
  label: string;
  address: string;
  lng: number;
  lat: number;
  distanceMi?: number; // straight-line miles from the island, for search suggestions
};

export type ForecastPoint = {
  offsetMin: number; // minutes from "now"
  at: string; // ISO timestamp of the departure
  clock: string; // "7:15 PM", local to the route (Eastern)
  minutes: number | null; // predicted door-to-door drive time
};

export type Forecast = {
  generatedAt: string;
  origin: LngLat;
  dest: LngLat;
  distanceMi: number | null;
  now: number | null;
  freeFlow: number | null; // off-peak baseline; the "clear run" time
  points: ForecastPoint[];
  best: ForecastPoint | null;
  worst: ForecastPoint | null;
};

export type Incident = {
  id: string;
  type: string;
  roads: string[];
  direction: string | null;
  description: string;
  severe?: boolean; // accident / full closure -> emphasized
  when?: string | null; // set for upcoming (not yet active) events: "Fri 8:00a – 11:00p"
};

export type Weather = { tempF: number; precipIn: number; code: number; windMph: number; gustMph?: number } | null;

// Active NWS alerts for the Topsail forecast zones. `storm` marks the ones
// that should take over the page (hurricane, tropical storm, surge, evacuation).
export type WeatherAlert = {
  id: string;
  event: string;
  severity: string;
  window: string; // "Sat 11a – Sun 11a", Eastern
  storm: boolean;
  warning: boolean;
};

// Today's NWS Surf Zone Forecast for Coastal Pender (Surf City, Topsail Beach).
export type Beach = {
  rip: "Low" | "Moderate" | "High";
  surf: string | null; // "Around 2 feet"
  water: string | null; // "mid 70s"
  next: { label: string; rip: "Low" | "Moderate" | "High" } | null; // the following period
};

// An Atlantic storm close enough to watch, from NHC's active-storm list.
export type StormWatch = { name: string; kind: string; miles: number; url: string };

export type TideEvent = { type: "high" | "low"; clock: string }; // next events, chronological

export type Sun = { sunriseClock: string; sunsetClock: string };

export type ConditionsData = {
  incidents: Incident[];
  omitted?: number;
  weather: Weather;
  tides?: TideEvent[] | null;
  sun?: Sun | null;
  alerts?: WeatherAlert[];
  beach?: Beach | null;
  storms?: StormWatch[];
  incidentsDown?: boolean; // both NCDOT feeds failed: unknown, not clear
};

// /api/history payload, shared by the heatmap and the trip planner.
export type HistoryCell = {
  dow: number;
  hod: number;
  minutes: number;
  source: "actual" | "typical";
  samples: number;
};

export type HistoryData = {
  hours: number[];
  cells: HistoryCell[];
  totalActual: number;
  canonical: boolean;
};
