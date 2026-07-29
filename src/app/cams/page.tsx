import type { Metadata } from "next";
import Link from "next/link";
import { Cameras } from "@/components/Cameras";
import { PageHeader } from "@/components/PageHeader";
import { TipJar } from "@/components/TipJar";
import { ISLAND_CAMERA_MODE } from "@/lib/camera-config";

const ISLAND_CAM_EMBEDDED = ISLAND_CAMERA_MODE !== "link";

export const metadata: Metadata = {
  title: "Surf City Bridge Cam & Topsail Island Traffic Cameras — Live",
  description: ISLAND_CAM_EMBEDDED
    ? "Live island-side and NCDOT traffic cameras on the routes to Topsail Island. Free, no sign-up."
    : "Live NCDOT traffic cameras on the routes to Topsail Island, plus a direct link to Surfchex's Surf City bridge roundabout cam. Free, no sign-up.",
  alternates: { canonical: "/cams" },
  openGraph: {
    title: "Topsail Island traffic cams — live",
    description: ISLAND_CAM_EMBEDDED
      ? "Live island-side and NCDOT cameras on the way to Topsail Island."
      : "Live NCDOT cameras on the way to Topsail Island, plus the Surf City bridge cam on Surfchex.",
    url: "/cams",
  },
};

const CARD =
  "rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(2,6,23,0.04),0_16px_40px_-24px_rgba(2,6,23,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]";

const H2 = "font-serif text-2xl tracking-tight";
const PROSE = "mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300";

const CAM_NOTES = [
  {
    name: "Island roundabout (Surf City bridge cam)",
    body: ISLAND_CAM_EMBEDDED
      ? "The Island tab shows configured live video from the island side of the Surf City bridge."
      : "Surfchex hosts live video of the roundabout on the island side of the Surf City bridge. Their player only runs on Surfchex, so the Island tab links directly to it.",
  },
  {
    name: "NC-210 at JH Batts Rd",
    body: "NCDOT's camera on the mainland approach to the bridge. This is the last stretch everyone funnels through, whether you came down NC-210 from I-40 or up NC-50 through Hampstead.",
  },
  {
    name: "US-17 at Scotts Hill",
    body: "The main feeder from Wilmington. On summer Saturdays, backups between Porters Neck and Hampstead show up here before they reach the bridge.",
  },
  {
    name: "US-17 (Market St) at Porters Neck",
    body: "The Ogden/Porters Neck stretch of Market Street, where Wilmington-side congestion usually begins. If this camera looks bad, add time no matter which beach road you take.",
  },
  {
    name: "I-40 at Exit 408 (NC-210)",
    body: "The exit most Raleigh and Triangle traffic takes for Surf City. A backup on the ramp here means the NC-210 corridor is loaded.",
  },
];

const MORE_CAMS = [
  {
    name: "Surf City Pier — south view",
    href: "https://www.surfchex.com/cams/surf-city-pier-south/",
    who: "Surfchex",
  },
  {
    name: "Surf City Pier — north view",
    href: "https://www.surfchex.com/cams/surf-city-pier-north/",
    who: "Surfchex",
  },
  {
    name: "Seaview Pier, North Topsail Beach",
    href: "https://www.surfchex.com/cams/seaview-pier-north-topsail-beach/",
    who: "Surfchex",
  },
  {
    name: "Topsail Beach (south end)",
    href: "https://www.surfchex.com/cams/topsail-beach/",
    who: "Surfchex",
  },
  {
    name: "Surf City Pier still image",
    href: "https://www.wardrealty.com/topsail-island-webcam",
    who: "Ward Realty",
  },
];

const FAQ = [
  {
    q: "Is there a live camera of the Surf City bridge?",
    a: ISLAND_CAM_EMBEDDED
      ? "Yes. The Island tab shows the configured live camera on the island side of the bridge, and the NC-210 tab shows NCDOT's camera on the mainland approach."
      : "Yes. The Island tab links to Surfchex's live roundabout camera on the island side of the bridge. The NC-210 tab shows NCDOT's camera on the mainland approach without leaving this page.",
  },
  {
    q: "How can I check Topsail traffic before I leave home?",
    a: "Glance at the cameras on this page, then set your route on the Topsail Traffic home page for live drive times across the bridge and a forecast for the next three hours.",
  },
  {
    q: "Are there traffic cameras in North Topsail Beach or at the NC-210 bridge?",
    a: "No. NCDOT operates no cameras between Surf City and Jacksonville, including the North Topsail high-rise bridge. The closest views of the north end are beach cams like the Seaview Pier camera linked below.",
  },
  {
    q: "How often do the NCDOT cameras update?",
    a: "NCDOT serves a fresh snapshot roughly every minute, and this page refreshes them automatically about every 30 seconds while it is open.",
  },
];

export default function CamsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:py-12">
      <PageHeader
        title="Topsail Island traffic cams"
        lede={
          ISLAND_CAM_EMBEDDED
            ? "Live island-side and NCDOT views of NC-210, US-17, and I-40 in one place."
            : "Live NCDOT views of NC-210, US-17, and I-40 in one place, plus a direct link to Surfchex's Surf City bridge roundabout cam."
        }
      />

      <section className={`${CARD} animate-fade-up`}>
        <Cameras />
      </section>

      <section className="animate-fade-up py-8" style={{ animationDelay: "80ms" }}>
        <h2 className={H2}>What each camera shows</h2>
        <p className={PROSE}>
          Topsail Island only has two ways on and off, and almost everyone uses the Surf City bridge. That makes a
          handful of cameras surprisingly useful: one look at the right camera tells you more than a traffic map,
          because you can see the actual line of cars.
        </p>
        <dl className="mt-4 space-y-4">
          {CAM_NOTES.map((c) => (
            <div key={c.name}>
              <dt className="font-medium text-slate-800 dark:text-slate-100">{c.name}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{c.body}</dd>
            </div>
          ))}
        </dl>
        <p className={PROSE}>
          NCDOT camera images appear courtesy of{" "}
          <a href="https://drivenc.gov" target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
            DriveNC.gov
          </a>
          . We checked: these five are every traffic camera NCDOT operates on the routes to the island — there are
          none on the island itself, at the North Topsail bridge, or in Holly Ridge or Sneads Ferry.
        </p>
      </section>

      <section className="animate-fade-up pb-8" style={{ animationDelay: "120ms" }}>
        <h2 className={H2}>More Topsail webcams</h2>
        <p className={PROSE}>
          These beach and pier cams are run by local businesses. They will not show you traffic, but they will show
          you the ocean you are driving toward:
        </p>
        <ul className="mt-3 space-y-1.5 text-[15px]">
          {MORE_CAMS.map((c) => (
            <li key={c.href}>
              <a href={c.href} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
                {c.name}
              </a>{" "}
              <span className="text-slate-400">— {c.who}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${CARD} animate-fade-up`} style={{ animationDelay: "160ms" }}>
        <h2 className={H2}>Cameras tell you now. The forecast tells you when.</h2>
        <p className={PROSE}>
          Topsail Traffic also measures live drive times across the Surf City bridge every few minutes and predicts
          the next three hours, so you can pick your window instead of guessing from a camera frame.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/"
            className="pressable inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            See live drive times
          </Link>
          <Link
            href="/best-time-to-leave"
            className="pressable inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-[13px] font-semibold text-sky-700 shadow-sm hover:border-sky-300 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-400"
          >
            Best time to leave →
          </Link>
        </div>
      </section>

      <section className="animate-fade-up py-8" style={{ animationDelay: "200ms" }}>
        <h2 className={H2}>Questions people ask</h2>
        <dl className="mt-4 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-slate-800 dark:text-slate-100">{f.q}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TipJar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </main>
  );
}
