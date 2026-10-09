import { NextResponse } from "next/server";
import { NCDOT_CAMS, isPlaceholder, snapshotUrl } from "@/lib/cams";

export type CamStatus = { id: string; live: boolean };

// Which cameras are showing a real picture right now, so the UI can open on a
// live one and mark the dead tabs. One server-side pass over every camera,
// shared through the CDN for a minute.
export async function GET() {
  const statuses: CamStatus[] = await Promise.all(
    NCDOT_CAMS.map(async ({ id }) => {
      try {
        const r = await fetch(snapshotUrl(id), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!r.ok) return { id, live: false };
        const bytes = (await r.arrayBuffer()).byteLength;
        return { id, live: !isPlaceholder(bytes) };
      } catch {
        return { id, live: false };
      }
    }),
  );
  return NextResponse.json(
    { cams: statuses },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
