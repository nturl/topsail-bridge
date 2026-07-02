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
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-slate-200/70 pt-5 text-xs dark:border-white/10">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
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
