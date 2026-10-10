# October 2026 upgrade

A ~100-agent review (2026-10-09) of cameras, data sources, UI, engineering and
growth, followed by this build. What shipped and what still needs the owner.

## Shipped

- **First visit answers the question.** No "set your route" gate: new visitors
  see the measured Surf City <-> Hampstead crossing (one CDN-shared forecast
  URL, so first visits don't multiply Mapbox calls).
- **Verdict graded against a clear run** (free-flow), not the best point in the
  next 3 hours, which called a uniformly jammed Saturday "Clear". Thresholds
  scale with route length; no "hold off" while a crash is live; storm alerts
  override. The gauge uses the same scale.
- **Cameras:** added 6157 (NC-50/210 junction) and 6141 (US-17 Porters Neck),
  dropped 6043; health check opens on a live camera; dead feeds are a compact
  row; freshness stamp, tap to enlarge, NCDOT attribution; `/cams` grid; the
  proxy is CDN-cached in 30 s buckets instead of one NCDOT hit per viewer.
- **Storm and beach data:** NWS alerts banner, NHC storm watch within ~600 mi,
  official evacuation links; wind gusts; NWS rip current risk, surf and water
  temperature; parking and swim-advisory links.
- **Planner and heatmap:** window toggle with a one-line departure answer,
  "Arrive Sat" / "Check out Sat", measured (solid) vs predicted (striped),
  colorblind-safe ramp, bigger targets, worst-crossing summary.
- **Route editor:** one-tap town presets, swap, keyboard flow, cheaper
  geocoding (3+ chars, session cache, normalized cache keys).
- **Robustness:** timeouts on every upstream fetch; Mapbox failures never 500
  the forecast; all-null forecast is an uncached 503; "incident feed down" is
  shown as unknown, not all-clear; hollow typical weeks aren't cached for 7
  days; personal routes poll every 5 min instead of 2; history keys snap to
  ~1 km.
- **Data pipeline:** poll asks every 15 min off-peak (GitHub was delivering ~4
  runs a day); daily dead-man check; `/api/history` and `/best-time-to-leave`
  read the 20 KB `measured.json` live, so the page no longer lags 40% behind.
- **PWA:** versioned service worker that never serves cameras or stale data as
  fresh, offline page, install sheet per platform (incl. in-app browsers),
  Cams and Best-time shortcuts; phone bottom tab bar.
- **Other:** Next 16.2.4 -> 16.3.8 (critical `next/og` RCE and image/proxy
  advisories), `middleware.ts` -> `proxy.ts`; desktop two-column layout; live
  verdict in the share sheet; analytics events (share, route_set, cam_select,
  direction, install_open, tip_click); tip link tagged by page; pinch zoom
  allowed, focus rings, reduced motion, contrast; copy fixes (no overclaims,
  no "every 30 minutes"); `npm run poll` fixed; `npm run smoke`.

## Needs the owner (everything else is built and waiting)

1. **Poll cadence: done 2026-10-10.** Vercel Cron calls `/api/cron/poll` every
   30 min, which dispatches poll.yml with a fine-grained PAT
   (`GITHUB_DISPATCH_TOKEN`, Production, sensitive; repo nturl/topsail-bridge
   only, Actions read/write, expires in 366 days: renew it before then). First
   dispatched run logged both directions at 16:21 UTC.
2. **Rate limit** (needs the pricing dialog accepted, usage-based, cents/month):
   Vercel project topsail-bridge, Firewall, Configure, New Rule "Mapbox API rate
   limit": If Request Path matches `^/api/(forecast|history|geocode|staticmap)(/|$)`,
   Then Rate Limit, Fixed Window 60 s, limit 60, key IP, 429. Optionally run it
   as Log for a day first. No firewall config existed as of 2026-10-09.
3. **NCDOT:** written OK for snapshot reuse and any sponsor credit, plus a
   DriveNC developer key. Live video now uses NCDOT's own embed. (Permission
   drafts for items 3, 4 and 7 are kept outside this public repo.)
4. **Surfchex and Surf City IGA:** embed permission and a live stream URL.
5. **Facebook poster:** captions are data-driven and there's a dry run. Follow
   docs/facebook-setup.md, then `gh secret set FB_PAGE_ID -R nturl/topsail-bridge`,
   `gh secret set FB_PAGE_TOKEN -R nturl/topsail-bridge`, and run
   `gh workflow run fb-post -R nturl/topsail-bridge -f mode=turnover -f dry_run=true`.
6. **Mapbox billing:** confirm the invoice line items and recent invoices in the
   Mapbox console; the public price sheet doesn't reproduce the June bill
   (Search Box sessions are the likely difference).
7. **Ward Realty / RentABeach and The Breezeway:** permission for the pier still
   and for The Breezeway's live Pier Cam.

## Considered, not built

- Web Push "tell me when it clears": needs a subscription store and a sender.
- TomTom bridge-segment speeds: check storage terms before logging to a public repo.
- North Topsail (NC-210) second measured route: cheap to poll, but needs a UI decision.
- Dated notices file (e.g. the roundabout signal pilot): needs a current source.
