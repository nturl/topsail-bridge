# Topsail Traffic

Live and predicted drive times across the Surf City bridge onto and off Topsail Island, NC, plus traffic cams, tides, weather, and NCDOT alerts for the approach roads. Built for locals and renters deciding when to cross. Live at [topsailtraffic.com](https://topsailtraffic.com) (topsail.live redirects there).

## What it does

| Feature | Where |
|---|---|
| Live + 3-hour forecast with a Clear/Slow/Heavy verdict graded against a clear run (free-flow), and a "go now" / "hold off, saves N min" call; thresholds scale with route length | `src/components/Hero.tsx`, `src/lib/call.ts`, `src/lib/forecast.ts`, `src/app/api/forecast/route.ts` |
| First visit shows the measured Surf City <-> Hampstead crossing; a user-set route (any two points, one-tap town presets) is saved per device | `src/app/page.tsx`, `src/components/RouteEditor.tsx`, `src/lib/places.ts`, `localStorage` key `bw.route.v1` |
| Off/To the island direction toggle, remembered per device (`bw.dir.v1`), deep-linkable via `/?dir=back` and PWA shortcuts | `src/app/page.tsx`, `src/app/manifest.ts` |
| Conditions strip: temperature, wind and gusts, NWS rip current risk, surf and water temp, sunrise/sunset, next two tides, NCDOT/DriveNC incidents on the corridor, beach parking and swim-advisory links | `src/components/Conditions.tsx`, `src/app/api/conditions/route.ts` |
| Weather alert banner (NWS alerts for zones NCZ106/NCZ199, Atlantic storms within ~600 mi from NHC); hurricane, tropical storm and surge alerts take over the verdict and show official evacuation links | `src/components/AlertBanner.tsx`, `src/app/api/conditions/route.ts`, `src/lib/call.ts` |
| Traffic cameras: 5 NCDOT snapshot cams in route order (proxied, since NCDOT's CORS headers block direct browser fetches) with a health check that opens on the first live one, plus the island-side Surfchex link. `/cams` shows them all in a grid | `src/lib/cams.ts`, `src/components/Cameras.tsx`, `src/app/api/cam/route.ts`, `src/app/api/cams/route.ts` |
| Island camera source, switchable by config: an authorized HLS stream, an approved Surfchex embed, or a link-out (default) | `src/lib/camera-config.ts`, `docs/cameras.md` |
| Route map with congestion-colored overlay | `src/components/RouteMap.tsx`, `src/app/api/staticmap/route.ts` |
| 7-day trip planner and weekly heatmap, blending real cron readings with a Mapbox-predicted "typical week" for routes with no history yet | `src/components/TripPlanner.tsx`, `src/components/Heatmap.tsx`, `src/app/api/history/route.ts` |
| `/best-time-to-leave`: static heatmap + FAQ built from measured data | `src/app/best-time-to-leave/page.tsx` |
| `/swing-bridge-history`: SEO/FAQ page on the old swing bridge the current span replaced | `src/app/swing-bridge-history/page.tsx` |
| Add-to-home-screen install flow (native prompt on Chrome/Android, step-by-step mock for iOS Safari, share link) | `src/components/InstallSheet.tsx` |
| Offline shell: versioned service worker; last-seen data renders with its real age when the network is down, and unvisited pages get `public/offline.html` | `public/sw.js`, `src/components/ServiceWorkerRegister.tsx` |
| Phone bottom tab bar (Now / Cams / Best times) | `src/components/SiteNav.tsx` |
| Tip jar (Stripe payment link, visitor-chosen amount) | `src/components/TipJar.tsx` |
| Scheduled Facebook Page posts (weekend outlook / turnover / return traffic) | `scripts/fb-post.mjs`, `.github/workflows/fb-post.yml` |

## How it works

A GitHub Actions cron (`.github/workflows/poll.yml`) calls the Mapbox Directions API for the canonical route (Surf City to the Harris Teeter in Hampstead) in both directions, appends each reading to `data/log.ndjson`, runs `scripts/summarize-log.mjs` to fold the log into per-day/per-hour medians in `src/data/measured.json`, and commits and pushes both files straight to `main`. GitHub delays and drops scheduled runs: asking every 30 minutes delivered only about 4 runs a day by October 2026, so the workflow now asks every 15 minutes off the :00/:30 rush and `poll.mjs` skips a run when the last reading is under 25 minutes old. A daily `data-freshness` workflow fails (and GitHub emails the owner) when the newest reading is over 6 hours old. There is no database — the git history is the log; as of 2026-10-09 it holds 4,284 readings back to 2026-06-07. This is also why most of the repository's commits are timestamped `log: <ISO time>`.

At request time, `/api/history` (`src/app/api/history/route.ts`) reads the ~20 KB `src/data/measured.json` live from GitHub's raw content URL for the canonical route, so the trip planner and heatmap reflect the latest cron reading without a redeploy. `/best-time-to-leave` reads the same file with hourly ISR, falling back to the bundled copy. Any other user-picked route has no cron data at all; `/api/history` falls back to a Mapbox-predicted "typical week" for it, generated on demand and cached for 7 days (`unstable_cache`, `src/lib/mapbox.ts`).

The main page's forecast is always live: each load fans out to Mapbox for the current reading, a free-flow baseline, and predictions at 15-minute steps across the next 3 hours (`src/lib/forecast.ts`; the route handler's own comment puts this at 13 paid Mapbox calls per load, which is why `/api/forecast` and `/api/history` both reject coordinates outside a fixed North Carolina service box — `src/lib/geo.ts` — and `src/middleware.ts` blocks cross-site requests to `/api/*`).

A second, independent scheduled workflow (`.github/workflows/fb-post.yml`) posts to a Facebook Page three times a week (Fri 3:30pm, Sat 8:30am, Sun 10:30am ET). It no-ops silently until `FB_PAGE_ID` and `FB_PAGE_TOKEN` exist (see `docs/facebook-setup.md`).

## Run locally

Requires Node 20+ (CI runs Node 20) and npm.

```bash
npm install
npm run dev     # next dev
npm run build   # next build
npm start       # next start, serves the build
```

Without `MAPBOX_TOKEN` set, the forecast, route map, and geocoder silently return no data (`src/lib/mapbox.ts`, `src/lib/forecast.ts` treat a missing token as "no result," not an error).

To run the cron steps by hand:

```bash
MAPBOX_TOKEN=... npm run poll   # scripts/poll.mjs
npm run summarize               # rebuild src/data/measured.json from the log
```

`npm run smoke [-- <base-url>]` hits every page and API route once and checks the response shapes (default: production). Run it after every deploy.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MAPBOX_TOKEN` | yes, for any live data | Directions/geocoding/static-map calls (`src/lib/mapbox.ts`, `src/lib/forecast.ts`) and the cron scripts (`scripts/poll.mjs`, `scripts/seed-typical.mjs`). Set as both a GitHub Actions secret (for the poll workflow) and a Vercel project env var (for the deployed app). |
| `DRIVENC_KEY` | no | Keyed DriveNC event feed for incident alerts (`src/app/api/conditions/route.ts`); without it the route falls back to the keyless WZDx work-zone feed. |
| `NEXT_PUBLIC_AUTHORIZED_ISLAND_HLS_URL` | no | HTTPS `.m3u8` for an island camera you have rights to embed; takes priority over Surfchex (`src/lib/camera-config.ts`). Build-time only — redeploy after changing. |
| `NEXT_PUBLIC_SURFCHEX_EMBED_APPROVED` | no | Set to `"true"` only once Surfchex has approved the embed; otherwise the Island tab stays link-only. Build-time only. |
| `NEXT_PUBLIC_SITE_URL` | no | Overrides the canonical URL used in metadata (`src/app/layout.tsx`); defaults to `https://topsailtraffic.com`. |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | no | Facebook Page id and long-lived Page token for `scripts/fb-post.mjs`. See `docs/facebook-setup.md` for how to mint them. |

Secrets live in GitHub Actions repo secrets (for the two workflows) and Vercel's project environment settings (for the deployed app) — never in the repo. See also `docs/cameras.md` (camera licensing/config detail) and `docs/outreach.md` (sponsorship material; not app config).

## Deploy

Hosted on Vercel (project `topsail-bridge`). `vercel.json` sets `git.deploymentEnabled.main: false`, so pushing to `main` does not trigger a deploy — ship with `vercel --prod` or a manual redeploy from the Vercel dashboard. `topsail.live` is a short alias that 308-redirects to the canonical `topsailtraffic.com` (`next.config.ts`).

The GitHub Actions workflows deploy nothing themselves; they only commit data. `/api/history` and `/best-time-to-leave` pick up new cron readings without a deploy (they read `measured.json` from GitHub). After `vercel --prod`, run `npm run smoke`.

## Code map

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Main page: route state, polling, layout |
| `src/app/api/forecast`, `/history`, `/conditions`, `/geocode`, `/cam`, `/staticmap` | Server routes proxying Mapbox, DriveNC/WZDx, NOAA tides, and Open-Meteo |
| `src/app/best-time-to-leave`, `/swing-bridge-history`, `/cams` | Static and cam-focused pages |
| `src/proxy.ts` | Blocks cross-site requests to `/api/*` (Next 16's renamed middleware) |
| `src/components/Hero.tsx`, `src/lib/call.ts` | The verdict/headline logic |
| `src/lib/cams.ts`, `src/components/Cameras.tsx`, `src/lib/camera-config.ts` | Camera lineup, health check, tabs/grid, and the island-stream watchdog |
| `src/components/AlertBanner.tsx` | NWS/NHC alert banner and storm-mode links |
| `src/components/InstallSheet.tsx` | Add-to-home-screen flow |
| `src/components/RouteEditor.tsx`, `RouteMap.tsx`, `TripPlanner.tsx`, `Heatmap.tsx`, `ForecastChart.tsx` | Route entry, map, and history views |
| `src/lib/forecast.ts`, `mapbox.ts`, `geo.ts`, `places.ts`, `heat.ts` | Forecast building, Mapbox calls, service-area/quantization, canonical route, heat-scale math |
| `scripts/poll.mjs` | 30-minute cron logger (run by `poll.yml`) |
| `scripts/summarize-log.mjs` | Folds `data/log.ndjson` into `src/data/measured.json` |
| `scripts/seed-typical.mjs` | One-time typical-week seed via Mapbox `depart_at` predictions |
| `scripts/fb-post.mjs` | Facebook Page poster (run by `fb-post.yml`) |
| `scripts/smoke.mjs` | Post-deploy smoke test (`npm run smoke`) |
| `data/log.ndjson` | Append-only cron readings (the "database") |
| `src/data/measured.json`, `typical.json` | Derived medians and the seeded typical-week baseline |
| `docs/cameras.md`, `facebook-setup.md`, `outreach.md`, `IOS.md` | Reference docs — read these, don't duplicate them here |

## Tests

No unit test runner. `npm run smoke` is the post-deploy check; `npx tsc --noEmit` and `next build` are the pre-deploy checks.

## Limits and non-goals

- Not a general-purpose traffic app: `/api/forecast` and `/api/history` reject any origin/destination outside a fixed North Carolina service box (`src/lib/geo.ts`) to bound spend on paid Mapbox calls, not as a permissions feature.
- Only the canonical route has real measured history. Every other user-picked route runs on a Mapbox-predicted typical week, not actual readings.
- No push notifications; installation is add-to-home-screen only. `IOS.md` documents a considered (not started) native-wrap path, held pending a push feature that doesn't exist yet.
- No unit tests; changes are verified with the smoke script and live checks.

## Status

Live. First commit 2026-06-07. The October 2026 upgrade (first-visit answer, new camera lineup, storm mode, verdict regrade, planner rework, hardened routes) is recorded in `docs/upgrade-2026-10.md`, with the follow-ups that need the owner. See `IOS.md` for the one open, unstarted plan (native wrap, gated on push notifications).

## Credits and license

No LICENSE file — personal, undistributed project. Built on Next.js 16 / React 19 / Tailwind 4. Traffic data from the Mapbox Directions API. Incident data from NCDOT/DriveNC, falling back to the keyless WZDx work-zone feed. Tide predictions from NOAA CO-OPS (Ocean City Beach fishing pier station, the nearest to the bridge). Weather from Open-Meteo. NCDOT approach-camera snapshots via drivenc.gov; the island roundabout stream is hosted by Surfchex, credited on `/cams`.
