"use client";

import { useEffect, useState } from "react";

// Chrome/Edge on Android (and desktop) fire this; iOS Safari never does.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function AddSquareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
        {icon}
      </span>
      <span className="text-sm leading-snug text-slate-700 dark:text-slate-200">{children}</span>
    </li>
  );
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setInstalled(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-3xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">On your phone</h2>
          <button onClick={onClose} aria-label="Close" className="text-lg text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {installed ? (
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            You already have it. Topsail Traffic is on your home screen and opens full-screen like an app.
          </p>
        ) : installEvent ? (
          <div className="space-y-3">
            <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
              One tap puts Topsail Traffic on your home screen. It opens full-screen, like an app.
            </p>
            <button
              onClick={async () => {
                await installEvent.prompt();
                onClose();
              }}
              className="pressable w-full rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Install Topsail Traffic
            </button>
          </div>
        ) : ios ? (
          <ol className="space-y-3.5">
            <Step icon={<ShareIcon />}>
              Tap the <span className="font-semibold">Share</span> button in Safari (the square with the arrow).
            </Step>
            <Step icon={<AddSquareIcon />}>
              Scroll down and tap <span className="font-semibold">Add to Home Screen</span>.
            </Step>
            <li className="pl-13 text-sm leading-snug text-slate-500 dark:text-slate-400">
              That&rsquo;s it. It opens full-screen from your home screen, like an app.
            </li>
          </ol>
        ) : (
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            Open <span className="font-semibold">topsailtraffic.com</span> on your phone, then choose{" "}
            <span className="font-semibold">Install</span> or <span className="font-semibold">Add to Home Screen</span>{" "}
            from your browser&rsquo;s menu.
          </p>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400">
          No app store, nothing to download. It&rsquo;s free.
        </p>
      </div>
    </div>
  );
}
