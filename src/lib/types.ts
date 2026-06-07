export type LngLat = { lng: number; lat: number };

export type Place = { label: string; address: string; lng: number; lat: number };

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
};

export type Weather = { tempF: number; precipIn: number; code: number; windMph: number } | null;

export type ConditionsData = { incidents: Incident[]; omitted?: number; weather: Weather };
