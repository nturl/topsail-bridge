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
};

export type Weather = { tempF: number; precipIn: number; code: number; windMph: number } | null;

export type TideEvent = { type: "high" | "low"; clock: string }; // next events, chronological

export type Sun = { sunriseClock: string; sunsetClock: string };

export type ConditionsData = {
  incidents: Incident[];
  omitted?: number;
  weather: Weather;
  tides?: TideEvent[] | null;
  sun?: Sun | null;
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
