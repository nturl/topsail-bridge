// Shared color + label vocabulary for the weekly heatmap and the trip planner,
// so a given minutes-level reads the same everywhere.

export function heatColor(t: number): string {
  const hue = 145 - 145 * Math.max(0, Math.min(1, t)); // green -> red
  return `hsl(${hue}, 68%, 46%)`;
}

// Anchor the color scale to the 90th percentile so a single slow cell doesn't
// flatten everything else to green.
export function heatScale(values: number[]): { norm: (v: number) => number } {
  const s = [...values].sort((a, b) => a - b);
  const lo = s[0] ?? 0;
  const hi = Math.max(s[Math.floor(s.length * 0.9)] ?? lo, lo + 1);
  return { norm: (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo))) };
}

export function hourLabel(h: number): string {
  const ap = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}
