import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
  title: "Topsail Traffic | Surf City Bridge Live Traffic & Cam",
  description:
    "When to leave (and return to) Topsail Island, NC. Live and predicted drive times across the Surf City bridge, the live bridge cam, a 7-day trip planner, tides, and NCDOT alerts. Free, no ads.",
  applicationName: "Topsail Traffic",
  appleWebApp: {
    capable: true,
    title: "Topsail Traffic",
    statusBarStyle: "black-translucent",
    // Launch screens per device class, so opening the PWA shows the TI oval
    // instead of a white flash. Keep in sync with SPLASH_SIZES in splash/[size].
    startupImage: [
      { url: "/splash/1320x2868", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1290x2796", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1284x2778", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1206x2622", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1179x2556", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1170x2532", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/1125x2436", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/splash/828x1792", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
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
        className="min-h-full text-slate-900 dark:text-slate-100"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {children}
        <ServiceWorkerRegister />
        {/* Web Analytics via the documented manual snippet: the component's
            client-side script injection was losing its tag to head
            reconciliation, so the dashboard sat at zero. script.js auto-tracks
            pageviews and SPA navigations. */}
        <Script id="va-init" strategy="afterInteractive">
          {`window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };`}
        </Script>
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Topsail Traffic",
              url: "https://topsailtraffic.com",
              description:
                "Live and predicted traffic across the Surf City bridge: when to leave (and return to) Topsail Island, NC.",
              applicationCategory: "TravelApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              about: { "@type": "Place", name: "Surf City Bridge, Topsail Island, North Carolina" },
            }),
          }}
        />
      </body>
    </html>
  );
}
