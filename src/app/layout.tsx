import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://topsailtraffic.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Topsail Traffic",
  description:
    "When to leave (and return to) Topsail Island. Live and predicted traffic across the Surf City bridge, your weekly rhythm, the live bridge cam, and NCDOT incidents.",
  applicationName: "Topsail Traffic",
  appleWebApp: {
    capable: true,
    title: "Topsail Traffic",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Topsail Traffic",
    description: "When to leave (and return to) Topsail Island, across the Surf City bridge.",
    url: SITE_URL,
    siteName: "Topsail Traffic",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Topsail Traffic",
    description: "When to leave (and return to) Topsail Island, across the Surf City bridge.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full bg-sky-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {children}
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
