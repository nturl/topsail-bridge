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

Live video ("Watch live") takes one of two paths:

- **Open streams play in our own player.** A camera whose DriveNC stream needs
  no auth (`data-videoauth="false"`) carries its manifest as `hls` in
  `src/lib/cams.ts`, and one tap plays it inline (`LiveVideo` in
  `src/components/Cameras.tsx`: hls.js, native HLS on Safari, with the snapshot
  as poster, a LIVE badge, and the stall watchdog). The card credits "NCDOT via
  DriveNC" and shows NCDOT's Live Traffic Video Disclaimer verbatim (from
  drivenc.gov/about/disclaimer). Hidden tabs pause the stream. If it fails to
  start (blocked port, 401, outage), the card drops to the DriveNC map below.
  As of 2026-10-11 only 6141 Porters Neck is open; the stream is CORS-open
  fMP4 HLS on `cfsse08.services.ncdot.gov:8887`. Decided by Noel 2026-10-11,
  ahead of NCDOT's reply to the permission email.
- **Gated streams play through NCDOT's own map.** For the rest (5400, 6157,
  4781, 6116), the card opens NCDOT's embeddable DriveNC map (`liveMapUrl`,
  from drivenc.gov/map/embeddedmapsetup), centered on the camera with only the
  cameras layer, and a pulsing ring marks the pin (about 32 px above frame
  center, `pointer-events: none`, gone once the visitor taps into the frame).
  Tapping the pin, then Show Video, plays the stream inside DriveNC's frame.
  The embed has no camera-select parameter and a cross-origin frame can't be
  clicked from our page, so the ring is the most we can do. The frame loads
  only on tap because it brings Google Maps and NCDOT's Google Analytics.

Never replay a gated stream: those need a token from DriveNC's same-origin
`/Camera/GetVideoUrl`, and nothing grants that use. If NCDOT says yes to the
permission email, gated cams can move to the inline player.

DriveNC's robots.txt disallows `/List/GetData/` and `/map/map*/`. The app only
fetches `/map/Cctv/<id>` snapshots; don't build on the list endpoints. The
sanctioned machine route is the DriveNC developer API (key required).

## Other live video near the island

Checked 2026-10-09 (YouTube, Twitch, Facebook, IPCamLive, HDOnTap, EarthCam,
Windy, WeatherSTEM, SECOORA, TV station cams, local businesses): every
business cam on the island runs through Surfchex and was offline or showing
the promo loop. The one live feed found is The Breezeway Restaurant & Motel's
"Pier Cam" in Topsail Beach (sound side, dock and patio, not traffic), an
Angelcam player at `https://v.angelcam.com/iframe?v=1erobzbvl8` that frames
fine. Embed only after the owner says yes.

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
