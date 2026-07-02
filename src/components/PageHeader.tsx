import Link from "next/link";
import { HeaderMark } from "./HeaderMark";

// Compact header for content pages: brand link home plus the page's H1.
export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="mb-6 animate-fade-up">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <HeaderMark />
        Topsail Traffic
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">{lede}</p>
    </header>
  );
}
