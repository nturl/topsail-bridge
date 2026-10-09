import type { ConditionsData } from "@/lib/types";

const NWS_POINT = "https://forecast.weather.gov/MapClick.php?lat=34.43&lon=-77.55";

// Official sources only: during a storm the app points at the people who make
// the calls (evacuation orders, re-entry) instead of paraphrasing them.
const STORM_LINKS = [
  { label: "Evacuation orders (ReadyNC)", href: "https://www.readync.gov/stay-informed/evacuation-orders" },
  { label: "NCDOT evacuation routes", href: "https://www.ncdot.gov/travel-maps/maps/Pages/evacuation-routes.aspx" },
  { label: "Topsail Beach re-entry", href: "https://topsailbeachnc.gov/Residents/Hurricane-Preparedness" },
  { label: "Surf City", href: "https://www.surfcitync.gov/" },
  { label: "North Topsail Beach", href: "https://www.northtopsailbeachnc.gov/" },
];

const LINK = "font-medium underline underline-offset-2 hover:opacity-80";

// NWS alerts for the island's forecast zones, plus any Atlantic storm within
// ~600 miles. Renders nothing on a normal day.
export function AlertBanner({ data }: { data: ConditionsData | null }) {
  const alerts = data?.alerts ?? [];
  const storms = data?.storms ?? [];
  if (alerts.length === 0 && storms.length === 0) return null;
  const stormMode = alerts.some((a) => a.storm);

  return (
    <div role="region" aria-label="Weather alerts" className="mb-5 animate-fade-up space-y-2">
      {alerts.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className={
            a.storm || a.warning
              ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
              : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
          }
        >
          <p>
            <span className="font-semibold">{a.event}</span> for the Topsail area, {a.window}.{" "}
            <a href={NWS_POINT} target="_blank" rel="noreferrer" className={LINK}>
              NWS details ↗
            </a>
          </p>
        </div>
      ))}

      {storms.map((s) => (
        <div
          key={s.name}
          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200"
        >
          <p>
            <span className="font-semibold">
              {s.kind} {s.name}
            </span>{" "}
            is about {s.miles.toLocaleString()} miles from the bridge.{" "}
            <a href={s.url} target="_blank" rel="noreferrer" className={LINK}>
              Latest NHC advisory ↗
            </a>
          </p>
        </div>
      ))}

      {stormMode && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            Follow official orders. NC-50 and NC-210 are the only roads off the island.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {STORM_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
