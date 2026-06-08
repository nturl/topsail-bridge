"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

async function search(q: string): Promise<Place[]> {
  if (!q.trim()) return [];
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    return ((await r.json()).results as Place[]) ?? [];
  } catch {
    return [];
  }
}

function PlaceField({
  id,
  label,
  initial,
  onSelect,
  withLocation,
}: {
  id: string;
  label: string;
  initial: Place | null;
  onSelect: (p: Place) => void;
  withLocation?: boolean;
}) {
  const [q, setQ] = useState(initial?.address ?? "");
  const [sugg, setSugg] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(initial?.address ?? ""), [initial?.address]);

  function onChange(v: string) {
    setQ(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => setSugg(await search(v)), 250);
  }
  function pick(p: Place) {
    setQ(p.address);
    setSugg([]);
    setOpen(false);
    onSelect(p);
  }
  function useLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`/api/geocode?lng=${pos.coords.longitude}&lat=${pos.coords.latitude}`);
          const p = (await r.json()).result as Place | null;
          if (p) pick(p);
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        id={id}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder="Search an address or place"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
      />
      {withLocation && (
        <button
          type="button"
          onClick={useLocation}
          disabled={locating}
          className="mt-1.5 text-xs text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-400"
        >
          {locating ? "Locating…" : "Use my current location"}
        </button>
      )}
      {open && sugg.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {sugg.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="block w-full px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-slate-700"
              >
                <span className="text-sm font-medium">{s.label}</span>
                <span className="block truncate text-xs text-slate-400">{s.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RouteEditor({
  open,
  origin,
  dest,
  onApply,
  onClose,
}: {
  open: boolean;
  origin: Place | null;
  dest: Place | null;
  onApply: (o: Place, d: Place) => void;
  onClose: () => void;
}) {
  const [o, setO] = useState<Place | null>(origin);
  const [d, setD] = useState<Place | null>(dest);
  useEffect(() => {
    setO(origin);
    setD(dest);
  }, [origin, dest, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-3xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Your route</h2>
          <button onClick={onClose} aria-label="Close" className="text-lg text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <PlaceField id="from" label="Starting point" initial={origin} onSelect={setO} withLocation />
          <PlaceField id="to" label="Destination" initial={dest} onSelect={setD} />
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              if (o && d) {
                onApply(o, d);
                onClose();
              }
            }}
            disabled={!o || !d}
            className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Save route
          </button>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Saved on this device. Use the toggle to flip direction.
        </p>
      </div>
    </div>
  );
}
