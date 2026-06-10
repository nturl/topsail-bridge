// Shared day-of-week + holiday + weather context, used by the hero "call",
// the trip planner, and the conditions panel so they stay consistent.

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

type YMD = { y: number; m: number; d: number; wd: string };

function easternYMD(date: Date): YMD {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), wd: get("weekday") };
}

// Pure calendar math (timezone-free once we have an Eastern Y-M-D).
function dowOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function serialDay(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d) / 86_400_000;
}
function lastMondayOfMay(y: number): number {
  for (let d = 31; d >= 25; d--) if (dowOf(y, 5, d) === 1) return d;
  return 25;
}
function firstMondayOfSeptember(y: number): number {
  for (let d = 1; d <= 7; d++) if (dowOf(y, 9, d) === 1) return d;
  return 1;
}

// The island's three traffic holidays. Long weekends run Friday through the
// Monday itself; July 4th gets the whole surrounding week.
function holidayContext({ y, m, d }: YMD): DayContext | null {
  const day = serialDay(y, m, d);
  const memorial = serialDay(y, 5, lastMondayOfMay(y));
  if (day >= memorial - 3 && day <= memorial)
    return {
      tag: "Memorial Day weekend",
      note: "Memorial Day weekend, the season opener. Heavy beach traffic through Monday evening.",
      turnover: true,
    };
  if (m === 7 && d <= 7)
    return {
      tag: "July 4th week",
      note:
        d >= 3 && d <= 5
          ? "Peak July 4th holiday. The biggest bridge days of the year; go early or wait until evening."
          : "July 4th week, the island's busiest stretch of the summer.",
      turnover: true,
    };
  const labor = serialDay(y, 9, firstMondayOfSeptember(y));
  if (day >= labor - 3 && day <= labor)
    return {
      tag: "Labor Day weekend",
      note: "Labor Day weekend, the season closer. Heavy beach traffic through Monday evening.",
      turnover: true,
    };
  return null;
}

export function dayContext(date: Date = new Date()): DayContext | null {
  const ymd = easternYMD(date);
  const holiday = holidayContext(ymd);
  if (holiday) return holiday;

  const { wd, m } = ymd;
  const summer = m >= 5 && m <= 9;
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
