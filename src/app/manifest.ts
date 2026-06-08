import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Topsail Traffic",
    short_name: "Topsail",
    description: "When to leave (and return to) Topsail Island. Live and predicted Surf City bridge traffic.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f9ff",
    theme_color: "#0ea5e9",
    icons: [
      { src: "/icons/manifest-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/manifest-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/manifest-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
