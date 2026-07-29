# Camera sources

## Default mode

Topsail Traffic opens on NCDOT's NC-210 snapshot and links the Island tab to
Surfchex. No Surfchex video is requested from Topsail Traffic in this mode.

NCDOT permits unaltered, non-commercial reuse unless a specific asset says
otherwise. Keep the existing DriveNC attribution and revisit permission before
adding advertising or other commercial use. See the
[NCDOT terms of use](https://www.ncdot.gov/about-us/how-we-operate/policy-process/Pages/terms-use.aspx).

## Authorized island camera

Set `NEXT_PUBLIC_AUTHORIZED_ISLAND_HLS_URL` to an HTTPS HLS manifest that you
own or have explicit permission to embed. This takes priority over Surfchex and
enables the Island player at build time.

## Approved Surfchex embed

Only after Surfchex has approved and allowlisted the site, set
`NEXT_PUBLIC_SURFCHEX_EMBED_APPROVED=true`. Without that flag, the Island tab
remains link-only. Both variables are build-time public configuration, so a new
deployment is required after changing them.
