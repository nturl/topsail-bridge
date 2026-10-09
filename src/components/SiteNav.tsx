"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Now",
    icon: (
      <path d="M3 12h3l3-8 6 16 3-8h3" />
    ),
  },
  {
    href: "/cams",
    label: "Cams",
    icon: (
      <>
        <rect x="2.5" y="6" width="14" height="12" rx="2.5" />
        <path d="m16.5 10.5 5-3v9l-5-3" />
      </>
    ),
  },
  {
    href: "/best-time-to-leave",
    label: "Best times",
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>
    ),
  },
];

// Phone-only bottom tab bar, so the cams and the planner are one thumb tap
// away (in the installed app there is no browser chrome to navigate with).
// Wider screens use the footer links.
export function SiteNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 backdrop-blur-md md:hidden dark:border-white/10 dark:bg-slate-950/90"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-sky-700 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
