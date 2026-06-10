import { NextRequest } from "next/server";

// Proxies NCDOT camera snapshots. The drivenc.gov endpoint sends duplicate
// Access-Control-Allow-Origin headers, which browsers reject, so the client
// can't fetch it directly; server-side we don't care. Allowlisted ids only.
const CAMS: Record<string, string> = {
  "5400": "https://www.drivenc.gov/map/Cctv/5400", // NC-210 at JH Batts Rd (mainland approach)
  "6043": "https://www.drivenc.gov/map/Cctv/6043", // US-17 at Scotts Hill (Wilmington run)
};

export async function GET(req: NextRequest) {
  const url = CAMS[req.nextUrl.searchParams.get("id") ?? ""];
  if (!url) return new Response(null, { status: 404 });

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok || !r.body) return new Response(null, { status: 502 });

  return new Response(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
