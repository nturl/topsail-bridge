import type { MetadataRoute } from "next";
import measured from "@/data/measured.json";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://topsailtraffic.com",
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: "https://topsailtraffic.com/cams",
      lastModified: new Date("2026-10-09"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://topsailtraffic.com/best-time-to-leave",
      lastModified: new Date(measured.lastAt),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://topsailtraffic.com/swing-bridge-history",
      lastModified: new Date("2026-07-02"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
