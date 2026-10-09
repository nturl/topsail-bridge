import { NextRequest } from "next/server";
import { NCDOT_CAM_IDS, snapshotUrl } from "@/lib/cams";

// Proxies NCDOT camera snapshots. The drivenc.gov endpoint sends duplicate
// Access-Control-Allow-Origin headers, which browsers reject, so the client
// can't fetch it directly; server-side we don't care. Allowlisted ids only.
// Clients ask with a 30-second bucket (?t=), so the CDN serves one fetch per
// camera per bucket to everyone instead of one per visitor.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!NCDOT_CAM_IDS.has(id)) return new Response(null, { status: 404 });

  try {
    const r = await fetch(snapshotUrl(id), { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok || !r.body) return new Response(null, { status: 502 });
    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch {
    return new Response(null, { status: 504 });
  }
}
