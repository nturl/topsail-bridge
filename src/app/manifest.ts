import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bridge Watch",
    short_name: "Bridge",
    description: "When to leave the island. Live and predicted Surf City bridge traffic.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f9ff",
    theme_color: "#0ea5e9",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
