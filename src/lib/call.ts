import type { ConditionsData, Forecast } from "./types";
import { dayContext } from "./context";

export type Tone = "emerald" | "amber" | "rose" | "slate";
export type Call = {
  verdict: string;
  tone: Tone;
  headline: string;
  notes: string[];
  // Minutes over a clear run right now, the clear-run baseline itself, and
  // how many minutes over it counts as heavy on this route.
  delay: number | null;
  base: number | null;
  heavyAt: number | null;
};

// Synthesizes the forecast + live conditions + day context into a single
// authoritative recommendation, instead of scattering them across the page.
export function buildCall(f: Forecast | null, c: ConditionsData | null): Call {
  if (!f || f.now == null || f.best?.minutes == null) {
    return {
      verdict: "—",
      tone: "slate",
      headline: "Checking the bridge…",
      notes: [],
      delay: null,
      base: null,
      heavyAt: null,
    };
  }

  // Judge congestion against a clear run (the off-peak baseline), not against
  // the best of the next three hours: on a jammed Saturday every point in the
  // window is slow, and "no slower than later" is not "Clear".
  const base = f.freeFlow ?? Math.min(f.best.minutes, f.now);
  const delay = Math.max(0, f.now - base);
  // Thresholds scale with the route: +4 min matters on a 9-minute bridge run,
  // not on a 2-hour drive from Raleigh.
  const slowAt = Math.max(4, Math.round(base * 0.25));
  const heavyAt = Math.max(9, Math.round(base * 0.6));
  const tone: Tone = delay < slowAt ? "emerald" : delay < heavyAt ? "amber" : "rose";
  const verdict = delay < slowAt ? "Clear" : delay < heavyAt ? `Slow · +${delay} min` : `Heavy · +${delay} min`;

  const inc = c?.incidents ?? [];
  const activeInc = inc.filter((i) => !i.when);
  const severeNow = activeInc.some((i) => i.severe);
  const save = f.now - f.best.minutes;
  const worthWaiting = Math.max(4, Math.round(f.now * 0.1));
  const worst = f.worst?.minutes != null ? f.worst : null;
  const swing = worst ? worst.minutes! - f.best.minutes : 0;
  const slowerLater = worst && worst.offsetMin > 0 && worst.minutes! - f.now >= 4 ? worst : null;

  // A hurricane, tropical storm or surge alert outranks the drive time: the
  // number below is still live, but it isn't the question anymore.
  const storm = c?.alerts?.find((a) => a.storm);
  if (storm) {
    return {
      verdict: storm.event,
      tone: "rose",
      headline: `${storm.event} for the Topsail area. Follow official orders before you drive; the time above is still live.`,
      notes: [],
      delay,
      base,
      heavyAt,
    };
  }

  let headline: string;
  // The later points are a typical-traffic model; they don't know about a
  // crash that is slowing the live reading, so don't promise it will clear.
  if (severeNow && delay >= slowAt) {
    headline = "A crash or closure near Topsail is slowing traffic now. Check the cams before you go.";
  } else if (f.best.offsetMin > 0 && save >= worthWaiting && !severeNow) {
    headline = `Hold off. Leaving at ${f.best.clock} saves about ${save} min.`;
  } else if (delay >= heavyAt) {
    headline = "Backed up, and it won't ease much in the next few hours. Go when you're ready.";
  } else if (slowerLater) {
    headline = `Go now. It gets slower around ${slowerLater.clock} (${slowerLater.minutes} min).`;
  } else if (swing < 3) {
    headline = "Good time to go. Steady for the next few hours.";
  } else {
    headline = "Good time to go. It won't get much quicker in the next few hours.";
  }

  const notes: string[] = [];
  const ctx = dayContext();
  if (ctx?.turnover) notes.push(ctx.note);
  if (c?.weather && c.weather.precipIn >= 0.02) notes.push("Rain on the island. Allow extra time.");
  // Sourced to a 2020 Surf City statement, so it's framed as what the town has said.
  if (c?.weather && c.weather.windMph >= 35)
    notes.push("Surf City has said it may close the bridge to cars in sustained winds of 45 mph. Check town notices.");

  if (severeNow && delay < slowAt) notes.push("NCDOT reports a crash or closure near Topsail; it isn't slowing this route yet.");
  if (activeInc.length > 0) {
    const roads = [...new Set(activeInc.flatMap((i) => i.roads))].slice(0, 3).join(", ");
    notes.push(
      `${activeInc.length} NCDOT alert${activeInc.length > 1 ? "s" : ""} near Topsail${roads ? ` (${roads})` : ""}.`,
    );
  }
  const upcoming = inc.length - activeInc.length;
  if (upcoming > 0) notes.push(`${upcoming} scheduled closure${upcoming > 1 ? "s" : ""} in the next two days.`);

  if (worst && swing >= 4 && !slowerLater) {
    notes.push(`The next few hours run ${f.best.minutes} to ${worst.minutes} min; heaviest near ${worst.clock}.`);
  }

  return { verdict, tone, headline, notes, delay, base, heavyAt };
}
