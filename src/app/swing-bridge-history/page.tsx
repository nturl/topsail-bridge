import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TipJar } from "@/components/TipJar";

export const metadata: Metadata = {
  title: "Surf City Swing Bridge History — What Happened to the Old Bridge?",
  description:
    "The Surf City swing bridge opened in 1955 and closed for good in 2018, replaced by a new 65-foot high-rise span. Here's what happened to it, and why bridge openings aren't why traffic backs up on Topsail Island anymore.",
  alternates: { canonical: "/swing-bridge-history" },
  openGraph: {
    title: "What happened to the Surf City swing bridge",
    description: "The swing bridge opened in 1955, closed for good in 2018, and was replaced by a fixed high-rise span.",
    url: "/swing-bridge-history",
  },
};

const CARD =
  "rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(2,6,23,0.04),0_16px_40px_-24px_rgba(2,6,23,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]";
const H2 = "font-serif text-2xl tracking-tight";
const PROSE = "mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300";

const FAQ = [
  {
    q: "What happened to the Surf City swing bridge?",
    a: "It was permanently closed and demolished after NCDOT opened a new fixed high-rise bridge on December 4, 2018. The old steel truss span that used to swing open for boats is gone; a bridge with 65 feet of vertical clearance now carries traffic in its place.",
  },
  {
    q: "When did the Surf City swing bridge close?",
    a: "Traffic moved onto the new high-rise bridge on December 4, 2018, and the old swing bridge went out of service that day. It was demolished over the following months, across 2018 and 2019.",
  },
  {
    q: "How old was the Surf City swing bridge?",
    a: "It opened in November 1955 and carried Topsail Island traffic for 63 years, until the new bridge replaced it in December 2018.",
  },
  {
    q: "Why was the swing bridge replaced?",
    a: "Age and traffic. The steel truss swing span had to physically open for boat traffic multiple times a day, stopping every car on the road each time it did. NCDOT's roughly $53 million replacement project built a fixed span with 65 feet of clearance that never needs to open, and it opened to traffic about nine months ahead of its original September 2019 target.",
  },
  {
    q: "Is the Surf City bridge still a swing bridge?",
    a: "No. Today's bridge is a fixed, 65-foot-clearance high-rise span that opened in 2018 and never opens for boats. If you're hitting backups now, that's vacation-season volume, not bridge openings — see our best-time-to-leave page for when the corridor actually slows down.",
  },
];

export default function SwingBridgeHistoryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:py-12">
      <PageHeader
        title="What happened to the Surf City swing bridge?"
        lede="The old swing bridge that stopped traffic every time it opened for boats closed for good in December 2018, replaced by a fixed, 65-foot-clearance high-rise span. Today's bridge never opens — so bridge openings aren't why traffic backs up on Topsail Island anymore."
      />

      <section className={`${CARD} animate-fade-up`}>
        <h2 className={H2}>The short answer</h2>
        <p className={PROSE}>
          The old Surf City swing bridge closed for good in December 2018 and was demolished over the following
          months. NCDOT replaced it with a fixed, 65-foot-clearance high-rise span that opened to traffic on
          December 4, 2018 — about nine months ahead of schedule. Because the new bridge sits high enough for boats
          to pass underneath, it never has to swing open, and it no longer stops traffic the way the old bridge did.
        </p>
      </section>

      <section className="animate-fade-up py-8" style={{ animationDelay: "80ms" }}>
        <h2 className={H2}>A brief history</h2>
        <p className={PROSE}>
          The original Surf City swing bridge opened in November 1955: a 255-foot steel truss span across the
          Intracoastal Waterway, built to swing open sideways whenever a boat needed to pass. For 63 years, that was
          the only way onto the middle of Topsail Island — and every time it opened, every car on the road stopped
          and waited.
        </p>
        <p className={PROSE}>
          By the 2010s the bridge was aging, and the daily openings were a growing bottleneck for an island that
          kept getting busier. NCDOT took on a roughly $53 million project to replace it with a fixed span tall
          enough that it would never need to open at all. The new high-rise bridge, with 65 feet of vertical
          clearance, opened to traffic on December 4, 2018 — about nine months ahead of its original September 2019
          target.
        </p>
        <p className={PROSE}>
          The old swing bridge was permanently closed the same day traffic shifted to the new span, then taken down
          in stages across 2018 and 2019. (If you're thinking of the other bridge onto Topsail Island — the one near
          Sneads Ferry at the island's north end — that one was never a swing bridge; this page is about the Surf
          City crossing in the middle of the island.)
        </p>
      </section>

      <section className={`${CARD} animate-fade-up`} style={{ animationDelay: "120ms" }}>
        <h2 className={H2}>Check the live number before you load the car</h2>
        <p className={PROSE}>
          The swing bridge is history — what slows you down now is volume, not bridge openings. Topsail Traffic
          shows the crossing time right now, a three-hour forecast, and the best window to go.
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
            See when to leave →
          </Link>
        </div>
      </section>

      <section className="animate-fade-up py-8" style={{ animationDelay: "160ms" }}>
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
