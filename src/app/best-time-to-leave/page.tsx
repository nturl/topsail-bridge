import type { Metadata } from "next";
import Link from "next/link";
import measured from "@/data/measured.json";
import { heatColor, heatScale, hourLabel } from "@/lib/heat";
import { PageHeader } from "@/components/PageHeader";
import { TipJar } from "@/components/TipJar";

export const metadata: Metadata = {
  title: "Best Time to Leave (and Get to) Topsail Island — Measured, Not Guessed",
  description:
    "When to cross the Surf City bridge, from live drive times measured every 30 minutes all summer: the quiet windows, the Saturday changeover crunch, and the hours to avoid.",
  alternates: { canonical: "/best-time-to-leave" },
  openGraph: {
    title: "The best time to leave (and get to) Topsail Island",
    description: "Measured drive times across the Surf City bridge, by day and hour.",
    url: "/best-time-to-leave",
  },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6a..9p
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Grid = Record<string, Record<string, { min: number; n: number }>>;

function cellsOf(grid: Grid): number[] {
  const out: number[] = [];
  for (let d = 0; d < 7; d++) for (const h of HOURS) {
    const c = grid[String(d)]?.[String(h)];
    if (c) out.push(c.min);
  }
  return out;
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Off-peak baseline: everything before 9am and from 6pm on, across both directions.
function baseline(): number {
  const vals: number[] = [];
  for (const grid of [measured.out as Grid, measured.back as Grid]) {
    for (let d = 0; d < 7; d++) for (const h of HOURS) {
      if (h >= 9 && h < 18) continue;
      const c = grid[String(d)]?.[String(h)];
      if (c) vals.push(c.min);
    }
  }
  return median(vals);
}

function peak(grid: Grid, dow: number, from: number, to: number): { min: number; hod: number } {
  let best = { min: 0, hod: from };
  for (let h = from; h <= to; h++) {
    const c = grid[String(dow)]?.[String(h)];
    if (c && c.min > best.min) best = { min: c.min, hod: h };
  }
  return best;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

const CARD =
  "rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(2,6,23,0.04),0_16px_40px_-24px_rgba(2,6,23,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]";
const H2 = "font-serif text-2xl tracking-tight";
const PROSE = "mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300";

function HeatTable({ grid, title, subtitle }: { grid: Grid; title: string; subtitle: string }) {
  const { norm } = heatScale(cellsOf(grid));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{title}</h3>
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-center text-[10px] leading-none">
          <thead>
            <tr>
              <th aria-label="Day" />
              {HOURS.map((h) => (
                <th key={h} className="pb-1 font-normal text-slate-400">
                  {hourLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, d) => (
              <tr key={day}>
                <th className="pr-1.5 text-right font-normal text-slate-400">{day}</th>
                {HOURS.map((h) => {
                  const c = grid[String(d)]?.[String(h)];
                  return c ? (
                    <td
                      key={h}
                      className="rounded px-0.5 py-1.5 font-medium text-white"
                      style={{ background: heatColor(norm(c.min)) }}
                      title={`${day} ${hourLabel(h)}: ${c.min} min (${c.n} readings)`}
                    >
                      {c.min}
                    </td>
                  ) : (
                    <td key={h} className="rounded bg-slate-100 py-1.5 text-slate-300 dark:bg-slate-800" />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BestTimePage() {
  const out = measured.out as Grid;
  const back = measured.back as Grid;
  const base = baseline();
  const satIn = peak(back, 6, 9, 12); // Saturday late-morning check-in wave, inbound
  const satOut = peak(out, 6, 9, 17); // Saturday daytime, outbound
  const friOut = peak(out, 5, 14, 18); // Friday afternoon, outbound
  const sunOut = peak(out, 0, 12, 17); // Sunday afternoon, outbound

  const FAQ = [
    {
      q: "What is the best time to cross the Surf City bridge?",
      a: `Before 9 in the morning or after 6 in the evening, any day of the week. In our measurements the benchmark crossing runs about ${base} minutes in those windows, every single day — even summer Saturdays.`,
    },
    {
      q: "What is the worst time to get to Topsail Island?",
      a: `Saturday late morning. Between the 10am rental check-out wave and day-trippers heading for the beach, inbound drive times have peaked around ${satIn.min} minutes at ${hourLabel(satIn.hod)} — roughly double a normal crossing.`,
    },
    {
      q: "When should I leave Topsail Island on check-out day?",
      a: `Check-outs cluster around 10am on Saturdays, and outbound times stay elevated from 9am until dinner. Leaving before 9am beats the wave; otherwise expect a slower ride until evening.`,
    },
    {
      q: "Does the Surf City bridge still open for boats?",
      a: "No. The old swing bridge was replaced by a fixed, 65-foot-clearance span that opened in 2018, so crossings no longer stop for boat traffic. Delays today come from volume, not bridge openings.",
    },
    {
      q: "How long does it take to get onto the island?",
      a: `Our benchmark route (Surf City to Hampstead, about five miles over the bridge) runs about ${base} minutes with no traffic. Summer weekend peaks have roughly doubled that.`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:py-12">
      <PageHeader
        title="The best time to leave (and get to) Topsail Island"
        lede={`Not folklore — measurement. Topsail Traffic has logged a live drive time across the Surf City bridge every 30 minutes since ${fmtDate(measured.firstAt)}: ${measured.samples.toLocaleString()} readings and counting. Here is what they say.`}
      />

      <section className={`${CARD} animate-fade-up`}>
        <h2 className={H2}>The short answer</h2>
        <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-100">Cross before 9am or after 6pm.</span>{" "}
            In every one of our readings so far, early and late crossings run about {base} minutes — even on July
            Saturdays.
          </li>
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              Arriving Saturday? Don&apos;t aim for mid-morning.
            </span>{" "}
            Inbound times have peaked at a median of {satIn.min} minutes around {hourLabel(satIn.hod)}, when the
            check-out wave meets day-trippers heading for the beach. Arrive before 9am, or roll in after 6pm when
            the island has settled.
          </li>
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              Leaving Saturday? Go early or go late.
            </span>{" "}
            Outbound stays slow from mid-morning through the afternoon, peaking around {satOut.min} minutes at{" "}
            {hourLabel(satOut.hod)}.
          </li>
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-100">Friday afternoon is sneaky.</span> The
            worst weekday window we have measured is Friday around {hourLabel(friOut.hod)}, at {friOut.min} minutes —
            weekend arrivals meet local rush hour.
          </li>
        </ul>
      </section>

      <section className="animate-fade-up py-8" style={{ animationDelay: "80ms" }}>
        <h2 className={H2}>What the data says, hour by hour</h2>
        <p className={PROSE}>
          Median minutes on our benchmark route — Surf City to Hampstead, about five miles across the bridge — from
          live readings taken every half hour. Green is a free-flowing crossing; red is roughly double that.
        </p>
        <div className="mt-5 space-y-7">
          <HeatTable grid={out} title="Leaving the island" subtitle="Surf City → Hampstead" />
          <HeatTable grid={back} title="Getting to the island" subtitle="Hampstead → Surf City" />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Medians of {measured.samples.toLocaleString()} live readings, {fmtDate(measured.firstAt)} –{" "}
          {fmtDate(measured.lastAt)}. Blank cells: no reading logged yet for that hour.
        </p>
      </section>

      <section className="animate-fade-up pb-8" style={{ animationDelay: "120ms" }}>
        <h2 className={H2}>Why Saturday is different</h2>
        <p className={PROSE}>
          Most Topsail Island vacation rentals run Saturday to Saturday: check-out by 10am, check-in at 4pm. That
          sends one wave off the island in the morning and another onto it in the afternoon — and in between,
          summer day-trippers keep the corridor moving slowly in both directions. In our measurements, Saturday
          crossings stay elevated from about 9am to 6pm either way. It is heavy enough that Surf City and Topsail
          Beach staff a joint traffic-management program on summer weekends. Sunday afternoon (peaking around{" "}
          {sunOut.min} minutes at {hourLabel(sunOut.hod)}) catches the weekenders heading home.
        </p>
        <p className={PROSE}>
          The bridge itself is no longer the bottleneck. The old Surf City swing bridge — which stopped traffic on
          the hour for boats — was replaced in 2018 by a fixed high-rise span. What is left is simple volume: a
          barrier island with two access points, and most traffic using this one. The pinch points now are the
          roundabout on the island side and the NC-210/NC-50 junction on the mainland. Curious about the old bridge?{" "}
          <Link href="/swing-bridge-history" className="text-sky-700 hover:underline dark:text-sky-400">
            Read its full history
          </Link>
          .
        </p>
        <p className={PROSE}>
          Holiday weeks amplify everything: expect July 4th and Labor Day Saturdays to run past the numbers above,
          and check the{" "}
          <Link href="/cams" className="text-sky-700 hover:underline dark:text-sky-400">
            live cameras
          </Link>{" "}
          before you commit to a departure time.
        </p>
      </section>

      <section className={`${CARD} animate-fade-up`} style={{ animationDelay: "160ms" }}>
        <h2 className={H2}>Check the live number before you load the car</h2>
        <p className={PROSE}>
          These tables are the rhythm; the live tool is the moment. Set your route once and Topsail Traffic shows
          the crossing time right now, a three-hour forecast, and the best window to go.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/"
            className="pressable inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            See live drive times
          </Link>
          <Link
            href="/cams"
            className="pressable inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-[13px] font-semibold text-sky-700 shadow-sm hover:border-sky-300 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-400"
          >
            Watch the cams →
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
