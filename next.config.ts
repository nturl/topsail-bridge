import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: here,
  },
  outputFileTracingRoot: here,
  // topsail.live is a short alias; topsailtraffic.com is canonical.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "topsail.live" }],
        destination: "https://topsailtraffic.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
