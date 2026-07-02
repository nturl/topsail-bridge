# Facebook auto-posting setup (one-time, ~30-45 min)

The repo already has the poster (`scripts/fb-post.mjs`) and the schedule
(`.github/workflows/fb-post.yml`: Fri 3:30pm, Sat 8:30am, Sun 10:30am ET).
It does nothing until the two secrets below exist. Everything here is free —
no App Review, no Business Verification, because you are only posting to a
Page you admin.

## 0. Prerequisite

A Facebook **Page** named Topsail Traffic that you admin (create one from your
personal profile if it doesn't exist yet: facebook.com/pages/create).

## 1. Create the Meta app

1. Go to https://developers.facebook.com/apps → **Create app**.
2. Use case: **Other** → app type: **Business** (important — Consumer-type
   apps left in dev mode can create posts only role-holders can see).
3. Name it anything ("Topsail Traffic Poster").

## 2. Mint a never-expiring Page token

1. Open the **Graph API Explorer** (developers.facebook.com/tools/explorer),
   select your new app.
2. Under Permissions add: `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `pages_manage_metadata` → **Generate Access Token**
   (log in, pick the Topsail Traffic Page when asked).
3. Exchange it for a long-lived user token (60 days) — in a terminal:

   ```
   curl "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"
   ```

   (APP_ID / APP_SECRET are on the app dashboard under Settings → Basic.)
4. Use that long-lived token to get the **Page** token:

   ```
   curl "https://graph.facebook.com/v23.0/me/accounts?access_token=LONG_LIVED_TOKEN"
   ```

   The response contains your Page's `id` and `access_token`.
5. Paste the Page token into the Token Debugger
   (developers.facebook.com/tools/debug/accesstoken) and confirm
   **Expires: Never**. This is the token to keep.

## 3. Add the secrets

```
cd ~/Claude/topsail-bridge
gh secret set FB_PAGE_ID    # the Page id from step 2.4
gh secret set FB_PAGE_TOKEN # the never-expiring Page token
```

## 4. Test

Actions tab → **fb-post** → Run workflow (mode: `outlook`). Then check the
post is visible **in a logged-out/incognito browser** — if only you can see
it, the app type is wrong (see step 1.2).

## Ongoing maintenance (near zero)

- **Data Use Checkup**: Meta emails you once a year; it's a ~10-minute
  questionnaire in the app dashboard. Miss it and the app loses API access.
- The token survives until you change your Facebook password or remove the
  app. If posting breaks, the workflow fails loudly and GitHub emails you;
  re-run steps 2-3.
- Bump `v23.0` in `scripts/fb-post.mjs` every couple of years (Graph API
  versions live ~2 years).

## The manual step that matters most

Automation posts to the Page; **groups are where the reach is**, and the
Groups API is dead (Meta removed it in 2024), so on Saturday mornings share
the Page's turnover post from your personal profile into 2-3 active Topsail
community groups. Sixty seconds, biggest multiplier available.
