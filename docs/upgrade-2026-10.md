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

## Needs the owner

1. **Poll cadence for real:** the 15-minute schedule helps, but GitHub may still
   drop runs. The robust fix is an external scheduler calling the
   `workflow_dispatch` endpoint with a fine-grained PAT (Actions: write on this
   repo only).
2. **Vercel firewall rate limit** on `/api/forecast`, `/api/history`,
   `/api/geocode`, `/api/staticmap` (~30 req/min per IP). Dashboard setting.
3. **NCDOT:** written OK for snapshot reuse (and any live video), plus a DriveNC
   developer key, before any sponsor placement.
4. **Surfchex:** send docs/outreach.md Email 1 via surfchex.com/contact for an
   embed or a live (non-promo) stream URL.
5. **Facebook poster:** set `FB_PAGE_ID` and `FB_PAGE_TOKEN`; every run so far
   has been a no-op (now flagged in the run summary).
6. **Mapbox billing:** reconcile Aug/Sep usage; today's price sheet doesn't
   reproduce the June bill, and Search Box free allowance looks different.
7. **Ward Realty pier still:** ask before embedding; it's the only live
   island-side image found.

## Considered, not built

- Web Push "tell me when it clears": needs a subscription store and a sender.
- TomTom bridge-segment speeds: check storage terms before logging to a public repo.
- North Topsail (NC-210) second measured route: cheap to poll, but needs a UI decision.
- Dated notices file (e.g. the roundabout signal pilot): needs a current source.
