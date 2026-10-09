"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";
import { ISLAND_PRESETS, MAINLAND_PRESETS, canonicalDir } from "@/lib/places";

// Geocoding costs Noel money per request, so the client only searches at 3+
// characters, waits for a pause in typing, and remembers every answer for the
// session (backspacing over "surf c" back to "surf" never re-queries).
const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;
const searchCache = new Map<string, Place[]>();

function normalize(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

async function search(key: string, signal: AbortSignal): Promise<Place[]> {
  const hit = searchCache.get(key);
  if (hit) return hit;
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(key)}`, { signal });
  if (!r.ok) return [];
  const results = ((await r.json()).results as Place[]) ?? [];
  searchCache.set(key, results);
  return results;
}

// Spots near the bridge that people pick often. Towns are chips (see places.ts).
const LOCAL_PICKS: Place[] = [
  { label: "Food Lion", address: "13601 NC-50, Surf City, NC", lng: -77.5621, lat: 34.4466 },
  { label: "Publix", address: "2765 NC-210, Hampstead, NC", lng: -77.564208, lat: 34.45184 },
];
const ALL_PICKS = [...ISLAND_PRESETS, ...MAINLAND_PRESETS, ...LOCAL_PICKS];

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
  if (ALL_PICKS.some((x) => x.address === p.address)) return; // always one tap away already
  try {
    const rest = loadRecents().filter((x) => x.address !== p.address);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([p, ...rest].slice(0, 4)));
  } catch {
    /* ignore */
  }
}

// Word-start match ("to" finds Topsail, not Alston); multi-word queries match anywhere.
function matches(text: string, key: string): boolean {
  const t = normalize(text);
  return key.includes(" ") ? t.includes(key) : t.split(/[\s,]+/).some((w) => w.startsWith(key));
}

function samePlace(a: Place | null, b: Place | null): boolean {
  return !!a && !!b && Math.abs(a.lng - b.lng) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4;
}

// Phones get no autofocus: popping the keyboard would cover the preset chips,
// which are the fast path there. Mouse and keyboard users get the full flow.
function finePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900";

function Option({
  id,
  place,
  active,
  onPick,
}: {
  id: string;
  place: Place;
  active: boolean;
  onPick: (p: Place) => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus in the input so blur doesn't close the list first
        onPick(place);
      }}
      className={`cursor-pointer px-3 py-2.5 ${
        active ? "bg-sky-50 dark:bg-slate-700" : "hover:bg-sky-50 dark:hover:bg-slate-700"
      }`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{place.label}</span>
        {place.distanceMi != null && (
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{place.distanceMi} mi</span>
        )}
      </span>
      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{place.address}</span>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li
      role="presentation"
      className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
    >
      {children}
    </li>
  );
}

function Chips({
  label,
  places,
  value,
  onPick,
}: {
  label: string;
  places: Place[];
  value: Place | null;
  onPick: (p: Place) => void;
}) {
  return (
    <div role="group" aria-label={label} className="mt-2">
      <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {places.map((p) => {
          const on = samePlace(p, value);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(p)}
              className={`pressable min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors ${FOCUS_RING} ${
                on
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-700"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlaceField({
  id,
  label,
  value,
  recents,
  onSelect,
  withLocation,
  enterHint,
}: {
  id: string;
  label: string;
  value: Place | null;
  recents: Place[];
  onSelect: (p: Place) => void;
  withLocation?: boolean;
  enterHint: "next" | "go";
}) {
  const [q, setQ] = useState(value?.address ?? "");
  const [sugg, setSugg] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dirty, setDirty] = useState(false); // has the user typed since focusing
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const listId = `${id}-list`;

  // A chip tap or swap changes the value from outside: show it and drop any half-typed query.
  useEffect(() => {
    setQ(value?.address ?? "");
    setDirty(false);
    setSugg([]);
    setActive(-1);
  }, [value?.address]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      inflight.current?.abort();
    },
    [],
  );

  const key = normalize(q);
  const typing = dirty && key.length > 0;
  // Typed text matches presets and recents locally first, so "ral" finds Raleigh
  // with no network call (and outside the geocoder's southeastern-NC box).
  const local = typing
    ? [...recents, ...ALL_PICKS.filter((p) => !recents.some((r) => r.address === p.address))]
        .filter((p) => matches(p.label, key) || matches(p.address, key))
        .slice(0, 4)
    : [];
  const remote = sugg.filter((s) => !local.some((l) => samePlace(l, s)));
  const picks = LOCAL_PICKS.filter((p) => !recents.some((r) => r.address === p.address));
  const options = typing ? [...local, ...remote] : [...recents, ...picks];

  function onChange(v: string) {
    setQ(v);
    setDirty(true);
    setActive(-1);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort();
    const k = normalize(v);
    if (k.length < MIN_CHARS) {
      setSugg([]);
      setSearching(false);
      return;
    }
    const cached = searchCache.get(k);
    if (cached) {
      setSugg(cached);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const ctl = new AbortController();
      inflight.current = ctl;
      try {
        const results = await search(k, ctl.signal);
        if (ctl.signal.aborted) return; // a newer query owns the list now
        setSugg(results);
      } catch {
        if (ctl.signal.aborted) return;
        setSugg([]);
      }
      setSearching(false);
    }, DEBOUNCE_MS);
  }

  function pick(p: Place) {
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort();
    setQ(p.address);
    setSugg([]);
    setOpen(false);
    setDirty(false);
    setSearching(false);
    setActive(-1);
    onSelect(p);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation(); // first Escape closes the list, the next closes the sheet
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter picks the highlighted row, or the top match while typing. Otherwise
      // it falls through to the form, which saves once both ends are set.
      if (open && active >= 0 && options[active]) {
        e.preventDefault();
        pick(options[active]);
      } else if (typing) {
        e.preventDefault();
        if (options.length) pick(options[0]);
      }
    }
  }

  function locate() {
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

  const short = typing && key.length < MIN_CHARS;
  const status = !typing
    ? null
    : searching
      ? "Searching…"
      : short
        ? local.length
          ? null
          : "Keep typing. Search starts at 3 letters."
        : options.length
          ? null
          : "No places found. Try the street or town name.";
  const showDropdown = open && (options.length > 0 || status != null);
  const activeId = active >= 0 && showDropdown ? `${id}-opt-${active}` : undefined;

  return (
    <div className="relative">
      <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </label>
      <input
        id={id}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          setDirty(false);
          e.target.select(); // typing a new place replaces the old one
        }}
        // The list opens on a tap, typing or ArrowDown, not on focus alone, so
        // autofocus doesn't cover the preset chips.
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        enterKeyHint={enterHint}
        placeholder="Search an address or place"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 sm:text-sm"
      />
      {withLocation && (
        <div className="mt-0.5">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className={`inline-flex min-h-11 items-center rounded text-xs text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-400 ${FOCUS_RING}`}
          >
            {locating ? "Locating…" : "Use my current location"}
          </button>
          {locError && <p className="text-xs text-rose-600 dark:text-rose-400">{locError}</p>}
        </div>
      )}
      {showDropdown && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white pb-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <ul id={listId} role="listbox" aria-label={`${label} suggestions`}>
            {typing ? (
              <>
                {local.length > 0 && remote.length > 0 && <SectionLabel>Quick picks</SectionLabel>}
                {local.map((p, i) => (
                  <Option key={`l-${p.address}`} id={`${id}-opt-${i}`} place={p} active={i === active} onPick={pick} />
                ))}
                {remote.length > 0 && local.length > 0 && <SectionLabel>Search results</SectionLabel>}
                {remote.map((p, i) => (
                  <Option
                    key={`s-${p.address}-${i}`}
                    id={`${id}-opt-${local.length + i}`}
                    place={p}
                    active={local.length + i === active}
                    onPick={pick}
                  />
                ))}
              </>
            ) : (
              <>
                {recents.length > 0 && <SectionLabel>Recent</SectionLabel>}
                {recents.map((p, i) => (
                  <Option key={`r-${p.address}`} id={`${id}-opt-${i}`} place={p} active={i === active} onPick={pick} />
                ))}
                {picks.length > 0 && <SectionLabel>Near the bridge</SectionLabel>}
                {picks.map((p, i) => (
                  <Option
                    key={`p-${p.address}`}
                    id={`${id}-opt-${recents.length + i}`}
                    place={p}
                    active={recents.length + i === active}
                    onPick={pick}
                  />
                ))}
              </>
            )}
          </ul>
          {status && (
            <p role="status" className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">
              {status}
            </p>
          )}
        </div>
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

  // Keyboard users land in the first empty field.
  useEffect(() => {
    if (!open || !finePointer()) return;
    const target = !origin ? "route-from" : !dest ? "route-to" : null;
    if (target) requestAnimationFrame(() => document.getElementById(target)?.focus());
  }, [open, origin, dest]);

  function focusField(id: string) {
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  // Picking from the list (keyboard is already up) moves on to the next empty
  // field. Chip taps only do that with a fine pointer, so phones keep the chips in view.
  function setStart(p: Place, viaChip = false) {
    setO(p);
    if (!viaChip) {
      saveRecent(p);
      setRecents(loadRecents());
    }
    if (!d && (!viaChip || finePointer())) focusField("route-to");
  }

  function setDest(p: Place, viaChip = false) {
    setD(p);
    if (!viaChip) {
      saveRecent(p);
      setRecents(loadRecents());
    }
    if (!o && (!viaChip || finePointer())) focusField("route-from");
  }

  const same = samePlace(o, d);
  const ready = !!o && !!d && !same;
  const blocker = !o && !d ? "Pick a start and destination" : !o ? "Pick a start" : !d ? "Pick a destination" : same ? "Pick two different places" : null;
  const measured = o && d ? canonicalDir(o, d) != null : false;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!o || !d || same) {
      focusField(!o ? "route-from" : "route-to");
      return;
    }
    onApply(o, d);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-title"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          // Enter with a missing end: jump to it instead of doing nothing.
          else if (e.key === "Enter" && !e.defaultPrevented && !ready && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            focusField(!o ? "route-from" : "route-to");
          }
        }}
        className="animate-sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-3xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="route-title" className="font-serif text-2xl">
            Your route
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`-mr-2 grid h-11 w-11 place-items-center rounded-full text-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 ${FOCUS_RING}`}
          >
            ✕
          </button>
        </div>

        <PlaceField id="route-from" label="Start" value={o} recents={recents} onSelect={(p) => setStart(p)} withLocation enterHint={d ? "go" : "next"} />
        <Chips label="Staying on the island" places={ISLAND_PRESETS} value={o} onPick={(p) => setStart(p, true)} />

        <div className="my-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={() => {
              setO(d);
              setD(o);
            }}
            disabled={!o && !d}
            aria-label="Swap start and destination"
            title="Swap start and destination"
            className={`pressable grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${FOCUS_RING}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
            </svg>
          </button>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <PlaceField id="route-to" label="Destination" value={d} recents={recents} onSelect={(p) => setDest(p)} enterHint={o ? "go" : "next"} />
        <Chips label="On the mainland" places={MAINLAND_PRESETS} value={d} onPick={(p) => setDest(p, true)} />

        {o && d && !same && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="min-w-0 truncate font-medium">
              {o.label} → {d.label}
            </span>
            {measured && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                Measured route
              </span>
            )}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={!ready}
            className={`pressable min-h-11 flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 ${FOCUS_RING}`}
          >
            {blocker ?? "Show drive times"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ${FOCUS_RING}`}
          >
            Cancel
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Saved on this device. Flip direction on the main screen.</span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={`inline-flex min-h-11 shrink-0 items-center rounded underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200 ${FOCUS_RING}`}
            >
              Reset to the bridge default
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
