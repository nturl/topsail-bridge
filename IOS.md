# Topsail Traffic on the iOS App Store

The honest framing first: the PWA already does ~90% of what an App Store app would do.
As of the June 2026 build it has launch screens (no white flash), the TI icon, home-screen
shortcuts (Leaving / Returning), offline handling, and refresh-on-reopen. What the App Store
adds is (1) discoverability ("topsail traffic" searched in the App Store), (2) push
notifications without the add-to-home-screen dance, and (3) credibility with non-technical
beach renters.

The right order: ship web push alerts first (Phase 2), then wrap. Push is the native-feeling
capability that makes the listing defensible in review.

## Path: Capacitor 8 shell

Wrap the live site in a thin native shell. Capacitor 8 (current: 8.4.x) uses Swift Package
Manager by default and requires Xcode 26+. This Mac has **Xcode 26.5 installed**, so the
toolchain is ready today. Apple has required iOS 26 SDK builds for all submissions since
April 28, 2026, which Xcode 26.5 satisfies.

Two wrap modes:

| Mode | How | Tradeoff |
|---|---|---|
| **Remote URL** (recommended) | Shell loads https://topsailtraffic.com directly (`server.url`) | App is always fresh, no resubmission for content changes. Needs network on first open. |
| Bundled static export | `next build` output copied into the shell | Works fully offline, but our pages are API-backed anyway, and every UI change means an App Store update. |

Remote URL is right for this app: every screen is live data.

## Prerequisites (one-time)

1. **Apple Developer Program**, $99/year, developer.apple.com (personal account is fine).
2. Bundle ID: `com.topsailtraffic.app` (register in the developer portal, or let Xcode do it).
3. Xcode signed into the Apple ID (Settings > Accounts), automatic signing.

## Commands

```bash
cd ~/Claude/topsail-bridge
npm install @capacitor/core @capacitor/cli @capacitor/ios

npx cap init "Topsail Traffic" com.topsailtraffic.app --web-dir public
# capacitor.config.ts: add
#   server: { url: "https://topsailtraffic.com", allowNavigation: ["topsailtraffic.com"] }

npx cap add ios
npx cap open ios   # opens Xcode; pick a simulator, hit Run
```

From Xcode: Product > Archive > Distribute App > App Store Connect, then fill out the
listing in appstoreconnect.apple.com and submit for review.

## App Store listing needs

- **Screenshots**: 6.9" (iPhone Pro Max) and 6.5" sets; take them in the simulator.
- **Privacy policy URL**: one static page. Truthful summary: location is used only to set
  your route, never stored server-side; routes live on-device; no accounts; Vercel
  Analytics is cookieless and anonymous.
- **App Privacy label**: Location (precise, app functionality, not linked to identity).
- **Age rating** 4+, **category** Navigation or Weather.

## The review risk, stated plainly

Guideline 4.2 (minimum functionality): Apple rejects apps that are "just a website."
A bare wrapper of the current site is a coin flip. What converts it to a likely pass:

1. **Native push** via APNs (`@capacitor/push-notifications`) wired to the same alert
   engine as web push. This is the big one, and why Phase 2 comes first.
2. **Native geolocation** (`@capacitor/geolocation`) so "use my location" uses the iOS
   permission prompt instead of the web one.
3. **Haptics** on the Leaving/Returning toggle and day picker (`@capacitor/haptics`).

All three are small Capacitor plugins reachable from the existing web code via
`window.Capacitor` checks. A weekend of work once push exists.

## Decision

Hold until push alerts ship. Then: wrap, add the three native touches, submit. Review
turnaround is typically 1 to 3 days. Total cost: $99/year plus a weekend.
