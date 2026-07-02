import { NextRequest, NextResponse } from "next/server";

// The /api routes proxy paid Mapbox endpoints, so hotlinking or cross-site
// scripting them spends real money. Block anything that positively announces
// itself as cross-site; requests with no signals at all (old browsers, direct
// navigation) pass, and the bbox checks in the routes bound what they can do.
const ALLOWED_HOSTS = new Set(["topsailtraffic.com", "www.topsailtraffic.com", "topsail.live", "www.topsail.live"]);

function allowedHost(host: string): boolean {
  return ALLOWED_HOSTS.has(host) || host.endsWith(".vercel.app") || host === "localhost" || host.startsWith("localhost:");
}

export function middleware(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return new NextResponse(null, { status: 403 });
  for (const header of ["origin", "referer"]) {
    const value = req.headers.get(header);
    if (!value) continue;
    try {
      if (!allowedHost(new URL(value).host)) return new NextResponse(null, { status: 403 });
    } catch {
      /* malformed header: ignore */
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
