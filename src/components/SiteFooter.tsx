import Link from "next/link";

const LINKS = [
  { href: "/", label: "Live drive times" },
  { href: "/cams", label: "Traffic cams" },
  { href: "/best-time-to-leave", label: "Best time to leave" },
];

// Server-rendered on every page: gives each page crawlable internal links and
// carries the data credits.
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 pb-10">
      <nav className="flex flex-wrap items-center justify-center gap-2.5 border-t border-slate-200/70 pt-5 dark:border-white/10">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="pressable inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        Topsail Traffic — live and predicted drive times across the Surf City bridge to Topsail Island, NC. Traffic
        from Mapbox, cams by Surf City IGA (via Surfchex) and NCDOT DriveNC, incidents from NCDOT, tides from NOAA.
      </p>
    </footer>
  );
}
