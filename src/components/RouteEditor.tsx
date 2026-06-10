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

// One-tap starting points for people who would rather not type.
const QUICK_PICKS: Place[] = [
  { label: "Surf City", address: "Surf City, NC", lng: -77.545585, lat: 34.427278 },
  { label: "Topsail Beach", address: "Topsail Beach, NC", lng: -77.628865, lat: 34.366405 },
  { label: "North Topsail Beach", address: "North Topsail Beach, NC", lng: -77.43024, lat: 34.488366 },
  { label: "Harris Teeter", address: "203 Alston Blvd, Hampstead, NC", lng: -77.605212, lat: 34.450868 },
  { label: "Food Lion", address: "13601 NC-50, Surf City, NC", lng: -77.5621, lat: 34.4466 },
  { label: "Publix", address: "2765 NC-210, Hampstead, NC", lng: -77.564208, lat: 34.45184 },
];

const RECENTS_KEY = "bw.recents.v1";

function loadRecents(): Place[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as Place[]).slice(0, 4);
  } catch {
    return [];
  }
}

function saveRecent(p: Place) {
  if (p.address === "My location") return; // raw GPS fallback; stale by tomorrow
  try {
    const rest = loadRecents().filter((x) => x.address !== p.address);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([p, ...rest].slice(0, 4)));
  } catch {
    /* ignore */
  }
}

function Row({
  place,
  active,
  onPick,
}: {
  place: Place;
  active: boolean;
  onPick: (p: Place) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onPick(place);
        }}
        className={`block w-full px-3 py-2 text-left ${
          active ? "bg-sky-50 dark:bg-slate-700" : "hover:bg-sky-50 dark:hover:bg-slate-700"
        }`}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{place.label}</span>
          {place.distanceMi != null && <span className="shrink-0 text-xs text-slate-400">{place.distanceMi} mi</span>}
        </span>
        <span className="block truncate text-xs text-slate-400">{place.address}</span>
      </button>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">{children}</li>
  );
}

function PlaceField({
  id,
  label,
  initial,
  recents,
  onSelect,
  withLocation,
}: {
  id: string;
  label: string;
  initial: Place | null;
  recents: Place[];
  onSelect: (p: Place) => void;
  withLocation?: boolean;
}) {
  const [q, setQ] = useState(initial?.address ?? "");
  const [sugg, setSugg] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dirty, setDirty] = useState(false); // has the user typed since focusing
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(initial?.address ?? ""), [initial?.address]);

  const picks = QUICK_PICKS.filter((p) => !recents.some((r) => r.address === p.address));
  const showSections = !dirty || !q.trim();
  const options = showSections ? [...recents, ...picks] : sugg;

  function onChange(v: string) {
    setQ(v);
    setDirty(true);
    setActive(-1);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      setSugg([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      setSugg(await search(v));
      setSearching(false);
    }, 250);
  }

  function pick(p: Place) {
    setQ(p.address);
    setSugg([]);
    setOpen(false);
    setDirty(false);
    setActive(-1);
    onSelect(p);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    }
  }

  function useLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        // Always usable even if reverse-geocoding fails (matters in iOS PWAs).
        let place: Place = { label: "My location", address: "My location", lng, lat };
        try {
          const r = await fetch(`/api/geocode?lng=${lng}&lat=${lat}`);
          if (r.ok) {
            const p = (await r.json()).result as Place | null;
            if (p) place = p;
          }
        } catch {
          /* keep the raw-coordinate fallback */
        }
        pick(place);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Allow location access for Topsail Traffic in your device settings."
            : "Couldn't get your location. Try again, or type your address.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  const showDropdown =
    open && (showSections ? options.length > 0 : searching || sugg.length > 0 || q.trim().length > 0);

  return (
    <div className="relative">
      <label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        id={id}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          setDirty(false);
          setOpen(true);
          e.target.select(); // typing a new place replaces the old one
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
        placeholder="Search an address or place"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
      />
      {withLocation && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={useLocation}
            disabled={locating}
            className="text-xs text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-400"
          >
            {locating ? "Locating…" : "Use my current location"}
          </button>
          {locError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{locError}</p>}
        </div>
      )}
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white pb-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {showSections ? (
            <>
              {recents.length > 0 && <SectionLabel>Recent</SectionLabel>}
              {recents.map((p, i) => (
                <Row key={`r-${p.address}`} place={p} active={i === active} onPick={pick} />
              ))}
              {picks.length > 0 && <SectionLabel>Nearby picks</SectionLabel>}
              {picks.map((p, i) => (
                <Row key={`p-${p.address}`} place={p} active={recents.length + i === active} onPick={pick} />
              ))}
            </>
          ) : searching ? (
            <li className="px-3 py-2.5 text-sm text-slate-400">Searching nearby…</li>
          ) : sugg.length > 0 ? (
            sugg.map((p, i) => <Row key={`${p.address}-${i}`} place={p} active={i === active} onPick={pick} />)
          ) : (
            <li className="px-3 py-2.5 text-sm text-slate-400">
              No places found nearby. Try the street or town name.
            </li>
          )}
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
  onClear,
  onClose,
}: {
  open: boolean;
  origin: Place | null;
  dest: Place | null;
  onApply: (o: Place, d: Place) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [o, setO] = useState<Place | null>(origin);
  const [d, setD] = useState<Place | null>(dest);
  const [recents, setRecents] = useState<Place[]>([]);

  useEffect(() => {
    setO(origin);
    setD(dest);
    if (open) setRecents(loadRecents());
  }, [origin, dest, open]);

  function picked(setter: (p: Place) => void) {
    return (p: Place) => {
      setter(p);
      saveRecent(p);
      setRecents(loadRecents());
    };
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-3xl"
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
          <PlaceField id="from" label="Starting point" initial={origin} recents={recents} onSelect={picked(setO)} withLocation />
          <PlaceField id="to" label="Destination" initial={dest} recents={recents} onSelect={picked(setD)} />
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
            className="pressable flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
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
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="mx-auto mt-4 block text-xs text-slate-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
          >
            Clear saved route
          </button>
        )}
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Saved on this device. Use the toggle to flip direction.
        </p>
      </div>
    </div>
  );
}
