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
// Requires FB_PAGE_ID and FB_PAGE_TOKEN (see docs/facebook-setup.md). Exits 0
// quietly when they are unset so the scheduled workflow is a no-op until the
// token exists; exits 1 loudly on API failures so Actions emails the owner.

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
if (!PAGE_ID || !TOKEN) {
  console.log("FB_PAGE_ID / FB_PAGE_TOKEN not set; skipping. See docs/facebook-setup.md to enable posting.");
  process.exit(0);
}

const SITE = "https://topsailtraffic.com";
const GRAPH = "https://graph.facebook.com/v23.0";

const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
const mode = process.argv[2] || { Fri: "weekend", Sat: "turnover", Sun: "return" }[weekday] || "outlook";

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

const now = fc.now;
const best = `${fc.best.clock} (${fc.best.minutes} min)`;
const worst = `${fc.worst.clock} (${fc.worst.minutes} min)`;

const MESSAGES = {
  weekend: `Weekend outlook 🌊 The Surf City bridge is running ${now} minutes right now. Over the next 3 hours the best window is around ${best} and the slowest is around ${worst}. Safe travels down NC-210 and NC-50! Live drive times and cams: topsailtraffic.com`,
  turnover: `Turnover Saturday ☀️ The bridge is at ${now} minutes right now. Checking out: leaving before 9am beats the wave. Checking in: it eases after 6pm. Next 3 hours: best around ${best}, slowest around ${worst}. Live: topsailtraffic.com`,
  return: `Heading home today? 🧳 The Surf City bridge is running ${now} minutes right now. Next 3 hours: best around ${best}, slowest around ${worst}. Check the live number before you load the car: topsailtraffic.com`,
  outlook: `Bridge check 🌉 The Surf City bridge is running ${now} minutes right now. Next 3 hours: best around ${best}, slowest around ${worst}. Live drive times and cams: topsailtraffic.com`,
};

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
