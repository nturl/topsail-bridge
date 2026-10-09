// Post-deploy smoke test: hits every page and API route once and checks the
// response shape, so a broken deploy shows up in a minute instead of on a
// Saturday. Usage: node scripts/smoke.mjs [base-url]  (default: production).
// Costs about one Mapbox forecast build, on the shared canonical route.
const BASE = (process.argv[2] ?? "https://topsailtraffic.com").replace(/\/$/, "");
const CANON = "o=-77.5456,34.4273&d=-77.6052,34.4509";

const checks = [
  ["home page", "/", async (r) => (await r.text()).includes("Topsail Traffic")],
  ["cams page", "/cams", async (r) => (await r.text()).includes("traffic cams")],
  ["best-time page", "/best-time-to-leave", async (r) => (await r.text()).includes("When to cross, day by day")],
  ["history page", "/swing-bridge-history", async (r) => r.ok],
  ["camera health", "/api/cams", async (r) => {
    const j = await r.json();
    return Array.isArray(j.cams) && j.cams.length >= 4 && j.cams.some((c) => c.live);
  }],
  ["camera snapshot", "/api/cam?id=6157&t=smoke", async (r) => (r.headers.get("content-type") ?? "").startsWith("image/")],
  ["conditions", "/api/conditions", async (r) => {
    const j = await r.json();
    return Array.isArray(j.incidents) && Array.isArray(j.alerts) && "beach" in j && "weather" in j;
  }],
  ["history (measured)", `/api/history?${CANON}`, async (r) => {
    const j = await r.json();
    return j.canonical === true && j.cells.length >= 100 && j.totalActual > 1000;
  }],
  ["forecast", `/api/forecast?${CANON}`, async (r) => {
    const j = await r.json();
    return typeof j.now === "number" && j.points.length > 1;
  }],
  ["manifest", "/manifest.webmanifest", async (r) => (await r.json()).shortcuts?.length >= 4],
  ["service worker", "/sw.js", async (r) => (await r.text()).includes("addEventListener")],
  ["offline page", "/offline.html", async (r) => r.ok],
];

let failed = 0;
for (const [name, path, ok] of checks) {
  const t0 = Date.now();
  let pass = false;
  let note = "";
  try {
    // Same-site header so the /api proxy guard treats this like the app itself.
    const r = await fetch(BASE + path, { headers: { "sec-fetch-site": "same-origin" }, signal: AbortSignal.timeout(20_000) });
    note = `${r.status}`;
    pass = r.ok && (await ok(r));
  } catch (e) {
    note = e instanceof Error ? e.message : String(e);
  }
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(20)} ${note.padEnd(4)} ${Date.now() - t0}ms  ${path}`);
}
console.log(failed ? `\n${failed} check(s) failed against ${BASE}` : `\nall ${checks.length} checks passed against ${BASE}`);
process.exit(failed ? 1 : 0);
