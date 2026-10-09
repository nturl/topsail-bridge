// Topsail Traffic service worker.
//
// What it caches, and why:
// - Pages (navigations): network-first. The last good copy is the offline
//   fallback, keyed by path so /?dir=out and /?dir=back share one entry. A page
//   never opened before falls back to /offline.html, not the browser's error.
// - /_next/static: cache-first. Those files are content-hashed, so a cached
//   copy is never stale.
// - Live JSON (/api/forecast, /api/conditions, /api/history): network-first.
//   The cached copy is served only when the network fails, only while it is
//   young enough to be useful, and always stamped with an x-sw-cached-at header
//   so the page can show its real age instead of passing it off as live.
// - Everything else under /api (camera frames and health, static maps,
//   geocoding) is never cached: an old cam frame or map reads as current.
//
// The version comes from the registration URL (/sw.js?v=<deploy>), so each
// deploy installs a fresh worker and activate drops the previous caches.

const VERSION = new URL(self.location.href).searchParams.get("v") || "1";
const SHELL = `tt-shell-${VERSION}`;
const DATA = `tt-data-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const CACHED_AT = "x-sw-cached-at";

const HOUR = 60 * 60 * 1000;
// How long a cached live response may stand in for the network.
const DATA_MAX_AGE = {
  "/api/forecast": 6 * HOUR,
  "/api/conditions": 6 * HOUR,
  "/api/history": 7 * 24 * HOUR,
};
const MAX_SHELL_ENTRIES = 150;
const MAX_DATA_ENTRIES = 12;

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.add(new Request(OFFLINE_URL, { cache: "no-cache" }));
      // Best effort: the home page plus the static files it references, so the
      // first launch with no signal opens the app instead of the offline page.
      try {
        const res = await fetch("/", { cache: "no-cache" });
        if (cacheable(res)) {
          const html = await res.clone().text();
          await cache.put("/", res);
          const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
          await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
        }
      } catch {
        /* offline during install: the offline page alone is enough */
      }
      // Take over right away; ServiceWorkerRegister reloads open pages at a
      // quiet moment so nobody runs old HTML against the new worker for long.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== DATA) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname in DATA_MAX_AGE) return e.respondWith(liveData(e, url));
  if (url.pathname.startsWith("/api/")) return; // cams, maps, geocode: network only
  if (request.mode === "navigate") return e.respondWith(page(e, url));
  if (url.pathname.startsWith("/_next/static/")) return e.respondWith(asset(e));
  // Anything else (RSC payloads, icons, analytics) goes to the network untouched.
});

// Only same-origin, successful, unredirected responses are worth keeping.
// Safari refuses a cached redirected response for a navigation.
function cacheable(res) {
  return res.ok && res.type === "basic" && !res.redirected;
}

async function page(e, url) {
  const cache = await caches.open(SHELL);
  const key = url.origin + url.pathname;
  try {
    const res = await fetch(e.request);
    if (cacheable(res) && (res.headers.get("content-type") ?? "").includes("text/html")) {
      e.waitUntil(cache.put(key, res.clone()).then(() => trim(SHELL, MAX_SHELL_ENTRIES)));
    }
    return res;
  } catch {
    return (await cache.match(key, { ignoreVary: true })) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function asset(e) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  if (cacheable(res)) e.waitUntil(cache.put(e.request, res.clone()).then(() => trim(SHELL, MAX_SHELL_ENTRIES)));
  return res;
}

async function liveData(e, url) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(e.request);
    if (cacheable(res)) {
      e.waitUntil(
        stamp(res.clone())
          .then((stamped) => cache.put(e.request, stamped))
          .then(() => trim(DATA, MAX_DATA_ENTRIES)),
      );
    }
    return res;
  } catch (err) {
    const hit = await cache.match(e.request);
    const age = Date.now() - Number(hit?.headers.get(CACHED_AT));
    if (hit && age < DATA_MAX_AGE[url.pathname]) return hit;
    if (hit) e.waitUntil(cache.delete(e.request));
    // Too old or never seen: fail like the network did, so the page shows its
    // own error and offline state instead of an old verdict.
    throw err;
  }
}

async function stamp(res) {
  const headers = new Headers(res.headers);
  headers.set(CACHED_AT, String(Date.now()));
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers });
}

// Drop the oldest entries past the cap (keys come back in insertion order, and
// a re-put moves an entry to the end). The offline page is never evicted.
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = (await cache.keys()).filter((k) => new URL(k.url).pathname !== OFFLINE_URL);
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}
