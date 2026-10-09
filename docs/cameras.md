# Camera sources

## NCDOT snapshots (the camera card and /cams)

Five DriveNC cameras, nearest the bridge first, defined once in
`src/lib/cams.ts` (which is also the `/api/cam` allowlist). Locations were
checked against OpenStreetMap on 2026-10-09.

| Id | Tab | Where |
|---|---|---|
| 5400 | Roland Ave | NC-50/210 (Roland Ave) at J H Batts Rd, the last stretch before the bridge |
| 6157 | Surf City | The NC-50 / NC-210 junction at Roland Ave on the mainland (a portable unit; DriveNC labels it US-17, which is wrong) |
| 6141 | Porters Neck | US-17 at Porters Neck, the approach from Wilmington |
| 4781 | Ogden | US-17 (Market St) at Torchwood |
| 6116 | I-40 | I-40 Exit 408 at NC-210, the approach from Raleigh |

Dropped: 6043 (US-17 Scotts Hill) pointed at a building and a lot, not the
road. Not added: 5405 (mobile unit 0.3 mi from the bridge, down at every
check) and the NC-417 Military Cutoff cams (too far from the island to help).
There are no DriveNC cameras in Onslow County, so nothing covers the North
Topsail (NC-210) bridge.

A down camera returns a stand-in image, not an error: statewide cams serve a
15,136-byte "no live feed" PNG, Wilmington signal cams a ~4 KB dark frame
(`isPlaceholder` in `src/lib/cams.ts`). `/api/cams` checks all five once a
minute so the card opens on the first live one and marks dead tabs.

NCDOT permits unaltered, non-commercial reuse unless a specific asset says
otherwise. Keep the DriveNC attribution and revisit permission before adding
advertising or other commercial use. See the
[NCDOT terms of use](https://www.ncdot.gov/about-us/how-we-operate/policy-process/Pages/terms-use.aspx).

Live video: DriveNC streams are HLS, and most require auth. A few (6141 and the
NC-417 cams) are marked open, but nothing NCDOT publishes grants embedding
them, so the app shows snapshots and links to DriveNC for video. Ask NCDOT in
writing before embedding any stream.

DriveNC's robots.txt disallows `/List/GetData/` and `/map/map*/`. The app only
fetches `/map/Cctv/<id>` snapshots; don't build on the list endpoints. The
sanctioned machine route is the DriveNC developer API (key required).

## Island camera: default mode

The Island tab links to Surfchex. No Surfchex video is requested from Topsail
Traffic in this mode. As of 2026-10-09 every Surfchex Topsail HLS path returns
the same promo loop to off-site players, and the bridge cam page itself said
"temporarily offline". Surfchex publishes no embed terms; the contact form is
the only route.

## Authorized island camera

Set `NEXT_PUBLIC_AUTHORIZED_ISLAND_HLS_URL` to an HTTPS HLS manifest that you
own or have explicit permission to embed. This takes priority over Surfchex and
enables the Island player at build time.

## Approved Surfchex embed

Only after Surfchex has approved and allowlisted the site, set
`NEXT_PUBLIC_SURFCHEX_EMBED_APPROVED=true`. Without that flag, the Island tab
remains link-only. Both variables are build-time public configuration, so a new
deployment is required after changing them.
