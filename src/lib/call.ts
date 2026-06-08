import type { ConditionsData, Forecast } from "./types";
import { dayContext } from "./context";

export type Tone = "emerald" | "amber" | "rose" | "slate";
export type Call = { verdict: string; tone: Tone; headline: string; notes: string[] };

// Synthesizes the forecast + live conditions + day context into a single
// authoritative recommendation, instead of scattering them across the page.
export function buildCall(f: Forecast | null, c: ConditionsData | null): Call {
  if (!f || f.now == null || f.best?.minutes == null) {
    return { verdict: "—", tone: "slate", headline: "Checking the bridge…", notes: [] };
  }

  const over = f.now - f.best.minutes;
  const tone: Tone = over <= 3 ? "emerald" : over <= 8 ? "amber" : "rose";
  const verdict = over <= 3 ? "Clear" : over <= 8 ? "Moderate" : "Heavy";

  const save = f.now - f.best.minutes;
  const headline =
    f.best.offsetMin > 0 && save >= 4
      ? `Hold off. Leaving at ${f.best.clock} saves about ${save} min.`
      : "Good time to go. It won't get much quicker in the next few hours.";

  const notes: string[] = [];
  const ctx = dayContext();
  if (ctx?.turnover) notes.push(ctx.note);
  if (c?.weather && c.weather.precipIn > 0) notes.push("Rain is dragging the drive slower than usual.");

  const inc = c?.incidents ?? [];
  if (inc.length > 0) {
    const roads = [...new Set(inc.flatMap((i) => i.roads))].slice(0, 3).join(", ");
    notes.push(`${inc.length} alert${inc.length > 1 ? "s" : ""} on the route${roads ? ` (${roads})` : ""}.`);
  }

  if (f.worst?.minutes != null && f.worst.minutes - f.best.minutes >= 4) {
    notes.push(`Today swings ${f.best.minutes} to ${f.worst.minutes} min; heaviest near ${f.worst.clock}.`);
  }

  return { verdict, tone, headline, notes };
}
