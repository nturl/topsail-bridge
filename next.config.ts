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
  // Baseline hardening. No Content-Security-Policy on purpose: Next's inline
  // scripts, HLS blob playback, the DriveNC map iframe and Pulse would each
  // need an allowance, and a wrong one breaks the cams.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
        ],
      },
    ];
  },
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
