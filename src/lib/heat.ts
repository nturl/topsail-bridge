// Shared color + label vocabulary for the weekly heatmap and the trip planner,
// so a given minutes-level reads the same everywhere.

// Green -> amber -> deep red, getting darker as it gets slower, so the scale
// still reads by lightness for red-green colorblind eyes and in bright sun.
function heatHSL(t: number): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [150 - 145 * k, 55 + 15 * k, 50 - 12 * k];
}

export function heatColor(t: number): string {
  const [h, s, l] = heatHSL(t);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// CSS background for one cell or bar. Measured readings are solid; predicted
// ones are diagonal stripes over a light tint of the same color, so "this is
// a guess" never depends on opacity (which already means other things).
export function heatFill(t: number, predicted: boolean): string {
  if (!predicted) return heatColor(t);
  const [h, s, l] = heatHSL(t);
  const c = `hsl(${h}, ${s}%, ${l}%)`;
  return `repeating-linear-gradient(135deg, ${c} 0 2px, transparent 2px 5px), hsla(${h}, ${s}%, ${l}%, 0.35)`;
}

// Anchor the color scale to the 90th percentile so a single slow cell doesn't
// flatten everything else to green, but never stretch less than 8 minutes:
// a route that only varies 10 to 13 min is easy all day, not green-vs-red.
export function heatScale(values: number[]): { norm: (v: number) => number; lo: number; hi: number } {
  const s = [...values].sort((a, b) => a - b);
  const lo = s[0] ?? 0;
  const hi = Math.max(s[Math.floor(s.length * 0.9)] ?? lo, lo + 8);
  return { lo, hi, norm: (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) };
}

export function hourLabel(h: number): string {
  const ap = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}
