import { track as vercelTrack } from "@vercel/analytics";

// Named product events for Vercel Web Analytics (pageviews are automatic).
// Never let analytics break a tap.
export function track(name: string, props?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(name, props);
  } catch {
    /* ignore */
  }
}
