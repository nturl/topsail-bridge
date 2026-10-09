"use client";

import { useEffect } from "react";

// Names the worker's caches; a new value per deploy makes every deploy install
// a fresh worker that drops the old caches (see public/sw.js). Vercel exposes
// these at build time; locally the worker isn't registered at all.
const SW_VERSION = (
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "1"
).slice(0, 12);

// Home-screen apps can sit in the background for days without a navigation,
// which is the only time browsers check for a new worker on their own.
const UPDATE_CHECK_MS = 30 * 60 * 1000;

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;

    // Dev: a caching worker fights hot reload. Remove any left from a prod test.
    if (process.env.NODE_ENV !== "production") {
      sw.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    let reg: ServiceWorkerRegistration | undefined;
    sw.register(`/sw.js?v=${encodeURIComponent(SW_VERSION)}`, { updateViaCache: "none" })
      .then((r) => (reg = r))
      .catch(() => {});

    // A new deploy's worker took over. This page may still reference chunks
    // the new deploy doesn't serve, so reload once, but never mid-glance: do it
    // when the app goes to the background, or the moment it comes back.
    // The first install also fires this; there is nothing stale to replace then.
    const hadController = Boolean(sw.controller);
    let reloadPending = false;
    let lastCheck = Date.now();
    const onControllerChange = () => {
      if (!hadController || reloadPending) return;
      reloadPending = true;
      if (document.visibilityState === "hidden") location.reload();
    };
    const onVisibility = () => {
      if (reloadPending) {
        location.reload();
        return;
      }
      if (document.visibilityState === "visible" && Date.now() - lastCheck > UPDATE_CHECK_MS) {
        lastCheck = Date.now();
        reg?.update().catch(() => {});
      }
    };
    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
