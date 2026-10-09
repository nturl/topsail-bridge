// Posts a live traffic update to the Topsail Traffic Facebook Page as a PHOTO
// post (link posts are suppressed by the feed algorithm; the site link goes in
// a first comment instead). Dependency-free, Node 20+.
//
// Modes (argv[2], or auto-detected from the current day in America/New_York):
//   weekend  - Friday afternoon "weekend outlook"
//   turnover - Saturday morning, rental changeover day
//   return   - Sunday morning, heading-home traffic
//   outlook  - generic, for manual runs
//
// Usage: node scripts/fb-post.mjs [mode] [--dry-run]
// --dry-run prints exactly what would post and needs no secrets.
//
// Requires FB_PAGE_ID and FB_PAGE_TOKEN (see docs/facebook-setup.md). Exits 0
// quietly when they are unset so the scheduled workflow is a no-op until the
// token exists; exits 1 loudly on API failures so Actions emails the owner.

import { appendFileSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
if (!DRY && (!PAGE_ID || !TOKEN)) {
  const msg = "FB_PAGE_ID / FB_PAGE_TOKEN not set; skipping. See docs/facebook-setup.md to enable posting.";
  console.log(msg);
  // Still green, but visible on the run page instead of buried in the log.
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `> Nothing posted: ${msg}\n`);
  process.exit(0);
}

const SITE = "https://topsailtraffic.com";
const GRAPH = "https://graph.facebook.com/v23.0";
const MEASURED_RAW = "https://raw.githubusercontent.com/nturl/topsail-bridge/main/src/data/measured.json";

const nowNY = new Date();
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(nowNY);
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MODES = ["weekend", "turnover", "return", "outlook"];
const mode = args.find((a) => !a.startsWith("--")) || { Fri: "weekend", Sat: "turnover", Sun: "return" }[weekday] || "outlook";
if (!MODES.includes(mode)) {
  console.error(`unknown mode "${mode}"; use one of ${MODES.join(", ")}`);
  process.exit(1);
}
// Which day's typical pattern each post talks about.
const PATTERN_DOW = { weekend: 6, turnover: 6, return: 0, outlook: DOW[weekday] };

const r = await fetch(`${SITE}/api/forecast`);
if (!r.ok) {
  console.error(`forecast fetch failed: ${r.status}`);
  process.exit(1);
}
const fc = await r.json();
if (fc.now == null || !fc.best || !fc.worst) {
  console.error("forecast has no live data; not posting");
  process.exit(1);
}

// Measured per-hour medians: live copy from main, bundled file as fallback.
async function loadMeasured() {
  try {
    const res = await fetch(MEASURED_RAW, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return await res.json();
  } catch {}
  return JSON.parse(readFileSync(new URL("../src/data/measured.json", import.meta.url), "utf8"));
}

const hr = (h) => `${h % 12 || 12}${h % 24 < 12 ? "am" : "pm"}`;

// Busy window = first to last daytime hour (6am-9pm) at least 3 min above the
// day's lightest hour (gaps inside it included, so it never understates);
// hours with fewer than 3 samples are ignored. Returns null when the data is
// too thin or the day never gets busy.
// dir: "out" = leaving the island (Surf City -> Hampstead), "back" = heading to it.
function pattern(measured, dow, dir = "out") {
  const day = measured?.[dir]?.[dow];
  if (!day) return null;
  const hours = [];
  for (let h = 6; h <= 21; h++) if (day[h] && day[h].n >= 3) hours.push([h, day[h].min]);
  if (hours.length < 10) return null;
  const base = Math.min(...hours.map(([, m]) => m));
  const busy = hours.filter(([, m]) => m >= base + 3);
  if (!busy.length) return null;
  const best = { start: busy[0][0], end: busy[busy.length - 1][0], peak: Math.max(...busy.map(([, m]) => m)) };
  const calm = hours.find(([h, m]) => h > best.end && m <= base + 2);
  return { busyFrom: best.start, busyTo: best.end + 1, peak: best.peak, calmFrom: calm ? calm[0] : null };
}

const measured = await loadMeasured();
// Arrivals (weekend outlook) read the to-the-island direction; leaving posts read off-island.
const p = pattern(measured, PATTERN_DOW[mode], mode === "weekend" ? "back" : "out");
const checkIn = mode === "turnover" ? pattern(measured, 6, "back") : null;
const dayWord = { weekend: "Saturdays", turnover: "Saturdays", return: "Sundays", outlook: "today" }[mode];
const typical = p
  ? `${dayWord === "today" ? "Typically today" : `On ${dayWord}`} it's busiest ${hr(p.busyFrom)} to ${hr(p.busyTo)}${p.calmFrom != null ? ` and calm again after ${hr(p.calmFrom)}` : ""}.`
  : "";

const now = fc.now;
const best = `${fc.best.clock} (${fc.best.minutes} min)`;
const worst = `${fc.worst.clock} (${fc.worst.minutes} min)`;
const next3 = `Next 3 hours: best around ${best}, slowest around ${worst}.`;
const join = (...parts) => parts.filter(Boolean).join(" ");

const MESSAGES = {
  weekend: join(`Weekend outlook. The Surf City bridge is running ${now} minutes right now.`, next3, typical, "Live drive times and cams: topsailtraffic.com"),
  turnover: join(
    `Turnover Saturday. The bridge is at ${now} minutes right now.`,
    p ? `Checking out? Leaving before ${hr(p.busyFrom)} beats the wave.` : "",
    checkIn && checkIn.calmFrom != null ? `Checking in? It eases after ${hr(checkIn.calmFrom)}.` : "",
    next3,
    "Live: topsailtraffic.com",
  ),
  return: join(`Heading home today? The Surf City bridge is running ${now} minutes right now.`, next3, typical, "Check the live number before you load the car: topsailtraffic.com"),
  outlook: join(`Bridge check. The Surf City bridge is running ${now} minutes right now.`, next3, typical, "Live drive times and cams: topsailtraffic.com"),
};

if (DRY) {
  console.log(`[dry-run] mode=${mode} (nothing posted)`);
  console.log(`[dry-run] photo: ${SITE}/api/staticmap`);
  console.log(`[dry-run] caption: ${MESSAGES[mode]}`);
  console.log(`[dry-run] first comment: Live drive times, all five traffic cams, and the weekly rhythm: ${SITE}`);
  process.exit(0);
}

async function graph(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok || json.error) {
    console.error(`Graph API ${path} failed:`, JSON.stringify(json.error ?? json));
    process.exit(1);
  }
  return json;
}

// Photo post: Facebook fetches the current traffic map itself.
const photo = await graph(`${PAGE_ID}/photos`, {
  url: `${SITE}/api/staticmap`,
  caption: MESSAGES[mode],
});

// The clickable link lives in the first comment, where it doesn't hurt reach.
const postId = photo.post_id ?? photo.id;
await graph(`${postId}/comments`, {
  message: `Live drive times, all five traffic cams, and the weekly rhythm: ${SITE}`,
});

console.log(`posted (${mode}): ${postId}`);
