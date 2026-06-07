// Shared day-of-week + weather context, used by the hero "call" and the
// conditions panel so they stay consistent.

export function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Mixed";
}

export type DayContext = { tag: string; note: string; turnover: boolean };

export function dayContext(): DayContext | null {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "numeric",
  }).formatToParts(new Date());
  const wd = p.find((x) => x.type === "weekday")?.value;
  const month = Number(p.find((x) => x.type === "month")?.value ?? "0");
  const summer = month >= 5 && month <= 9;
  if (wd === "Sat")
    return {
      tag: "Sat · turnover day",
      note: "Saturday is rental changeover, the island's busiest day. Worst late morning to mid-afternoon.",
      turnover: true,
    };
  if (wd === "Sun")
    return { tag: "Sun", note: "Weekend day-trippers head home through the late afternoon.", turnover: false };
  if (wd === "Fri")
    return { tag: "Fri", note: "Weekend arrivals build across the afternoon and evening.", turnover: false };
  if (summer)
    return { tag: "Beach season", note: "Summer volume runs heavier in mornings and late afternoons.", turnover: false };
  return null;
}
