// Slim support bar. The Stripe payment link is customer-chooses-amount
// ($1-$100, preset $5), created 2026-07-02 on the NT Stripe account.
const TIP_URL = "https://donate.stripe.com/aFabJ03X91MO1KwcTU6EU06";

export function TipJar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/10">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-800 dark:text-slate-100">Topsail Traffic is free.</span> Tips cover
        the maps and cameras that keep it that way.
      </p>
      <a
        href={TIP_URL}
        target="_blank"
        rel="noreferrer"
        className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 21s-7.5-5.2-10-9.6C.4 8.3 2.4 4.5 6 4.5c2 0 3.4 1 4.5 2.5a1.9 1.9 0 0 0 3 0C14.6 5.5 16 4.5 18 4.5c3.6 0 5.6 3.8 4 6.9C19.5 15.8 12 21 12 21z" />
        </svg>
        Chip in $5
      </a>
    </div>
  );
}
