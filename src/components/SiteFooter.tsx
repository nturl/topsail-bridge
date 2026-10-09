import Link from "next/link";

const LINKS = [
  { href: "/", label: "Live drive times" },
  { href: "/cams", label: "Traffic cams" },
  { href: "/best-time-to-leave", label: "Best time to leave" },
  { href: "/swing-bridge-history", label: "Swing bridge history" },
];

// Server-rendered on every page: gives each page crawlable internal links and
// carries the data credits. Quiet text links, so the footer doesn't outrank the
// page's own actions.
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 pb-10 xl:max-w-6xl">
      <nav
        aria-label="Site"
        className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 border-t border-slate-200/70 pt-5 text-sm dark:border-white/10"
      >
        {LINKS.map((l, i) => (
          <span key={l.href} className="inline-flex items-center">
            {i > 0 && (
              <span aria-hidden className="px-1.5 text-slate-300 dark:text-slate-600">
                ·
              </span>
            )}
            <Link
              href={l.href}
              className="rounded px-1 py-2 font-medium text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-400"
            >
              {l.label}
            </Link>
          </span>
        ))}
      </nav>
      <p className="mx-auto mt-3 max-w-2xl text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Topsail Traffic: live and predicted drive times across the Surf City bridge to Topsail Island, NC. Drive
        times from Mapbox. Camera images and incidents from NCDOT via DriveNC, provided for general travel
        information only. Weather alerts and surf forecast from the National Weather Service, tides from NOAA. Island
        cam by Surf City IGA via Surfchex.
      </p>
    </footer>
  );
}
