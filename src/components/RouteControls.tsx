"use client";

import { useState } from "react";
import type { Place } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
// Bias geocoding toward the Topsail / Hampstead area.
const PROXIMITY = "-77.66,34.4";

async function geocode(q: string): Promise<Place | null> {
  if (!q.trim() || !TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    q,
  )}.json?access_token=${TOKEN}&limit=1&country=us&proximity=${PROXIMITY}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j.features?.[0];
  if (!f) return null;
  return { label: f.text ?? q, address: f.place_name ?? q, lng: f.center[0], lat: f.center[1] };
}

async function reverseGeocode(lng: number, lat: number): Promise<Place> {
  const fallback: Place = { label: "My location", address: "My location", lng, lat };
  if (!TOKEN) return fallback;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return fallback;
    const j = await r.json();
    const f = j.features?.[0];
    return f
      ? { label: "My location", address: f.place_name ?? "My location", lng, lat }
      : fallback;
  } catch {
    return fallback;
  }
}

export function RouteControls({
  origin,
  dest,
  onApply,
  onReset,
}: {
  origin: Place;
  dest: Place;
  onApply: (o: Place, d: Place) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [oText, setOText] = useState(origin.address);
  const [dText, setDText] = useState(dest.address);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setErr(null);
    const [o, d] = await Promise.all([geocode(oText), geocode(dText)]);
    setBusy(false);
    if (!o || !d) {
      setErr("Couldn't find one of those. Try a fuller address.");
      return;
    }
    onApply(o, d);
    setOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = await reverseGeocode(pos.coords.longitude, pos.coords.latitude);
        setOText(p.address);
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-sky-700 underline-offset-4 hover:underline dark:text-sky-400"
      >
        Change route
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
        <div className="flex gap-2">
          <input
            value={oText}
            onChange={(e) => setOText(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
            placeholder="Your address on the island"
          />
          <button
            onClick={useMyLocation}
            className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Use my location
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
        <input
          value={dText}
          onChange={(e) => setDText(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
          placeholder="Where you're headed"
        />
      </div>
      {err && <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={apply}
          disabled={busy}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? "Finding…" : "Update"}
        </button>
        <button
          onClick={() => {
            onReset();
            setOpen(false);
          }}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          Reset
        </button>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
