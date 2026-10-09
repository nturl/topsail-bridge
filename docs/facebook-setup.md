# Facebook auto-posting setup (one-time, ~30 min)

The repo already has the poster (`scripts/fb-post.mjs`) and the schedule
(`.github/workflows/fb-post.yml`: Fri 3:30pm, Sat 8:30am, Sun 10:30am ET).
It does nothing until the two secrets below exist. Posting to a Page you
admin with your own app needs no App Review and no Business Verification.

Checked against Meta's developer docs on 2026-10-09: Graph API v26.0 is the
latest; the script's `v23.0` is valid until Oct 8, 2027 (bump `GRAPH` in
`scripts/fb-post.mjs` before then, e.g. to `v25.0`, valid to Jul 2028).

Required permissions for `POST /{page-id}/photos`: `pages_manage_posts`,
`pages_read_engagement`, `pages_show_list`. Also request `pages_manage_metadata`
(Meta's Pages API getting-started page lists it with the others). The Page
token must belong to someone who can perform the `CREATE_CONTENT` task on the
Page (a full admin does).

## 0. Prerequisite

A Facebook **Page** named Topsail Traffic that you admin (create from your
profile at facebook.com/pages/create if needed).

## 1. Create the Meta app

1. https://developers.facebook.com/apps -> **Create app**.
2. Pick the use case that covers managing Pages (the dashboard wording has
   changed over time; if offered, choose "Other" -> **Business** type). Keep
   the app in **Development** mode; as admin of both app and Page you do not
   need to publish it.
3. Name it "Topsail Traffic Poster".

The dashboard UI changes often, so if a label differs, the goal is: an app you
own, in Development mode, that can request the permissions above.

## 2. Mint a never-expiring Page token

1. Open the **Graph API Explorer** (developers.facebook.com/tools/explorer)
   and select your app.
2. Permissions: add `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `pages_manage_metadata`. Click **Generate Access
   Token**, log in, and select the Topsail Traffic Page when asked.
3. Exchange it for a long-lived user token (about 60 days). Run this in a
   terminal on your machine only, never in a browser or shared place, because
   it includes the app secret:

   ```
   curl "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"
   ```

   APP_ID / APP_SECRET: app dashboard, Settings -> Basic.
4. Get the Page token with the long-lived user token:

   ```
   curl "https://graph.facebook.com/v23.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN"
   ```

   Find the Topsail Traffic entry: `id` is the Page ID, `access_token` is the
   Page token. Confirm its `tasks` list includes `CREATE_CONTENT`. Per Meta's
   docs, a Page token obtained from a long-lived user token has no expiry.
5. Paste the Page token into the Token Debugger
   (developers.facebook.com/tools/debug/accesstoken) and confirm
   **Expires: Never**.

## 3. Add the secrets

```
gh secret set FB_PAGE_ID -R nturl/topsail-bridge
gh secret set FB_PAGE_TOKEN -R nturl/topsail-bridge
```

Each command prompts for the value; paste it and press Enter.

## 4. Test

1. Dry run first (default for manual runs, posts nothing, prints the caption):
   `gh workflow run fb-post -R nturl/topsail-bridge -f mode=turnover -f dry_run=true`
   then check the run log. Locally: `node scripts/fb-post.mjs turnover --dry-run`.
2. Real post: `gh workflow run fb-post -R nturl/topsail-bridge -f mode=outlook -f dry_run=false`.
3. Open the post in a logged-out/incognito browser. If only you can see it,
   the app is not set up to publish publicly; recheck step 1.

Captions are built from live traffic plus `src/data/measured.json` (read from
main, bundled copy as fallback), so the quiet and busy times they mention come
from measured data and update as it grows.

## Ongoing maintenance (near zero)

- **Data Use Checkup**: Meta emails you once a year; it's a short
  questionnaire in the app dashboard. Miss it and the app can lose API access.
- The token survives until you change your Facebook password, remove the app,
  or lose Page admin. If posting breaks, the workflow fails loudly and GitHub
  emails you; redo steps 2-3.
- Bump the Graph version before Oct 8, 2027.

## The manual step that matters most

Automation posts to the Page; **groups are where the reach is**, and the
Groups API is gone, so on Saturday mornings share the Page's turnover post
from your personal profile into 2-3 active Topsail community groups.
