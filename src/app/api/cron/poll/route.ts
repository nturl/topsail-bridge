import { NextRequest, NextResponse } from "next/server";

// Vercel Cron hits this every 30 min and asks GitHub to run poll.yml, because
// GitHub's own schedule trigger is throttled to a few runs a day. Safe by
// construction: no-op without GITHUB_DISPATCH_TOKEN, and it skips when the
// newest reading is under 25 min old, so hammering the URL dispatches nothing.
export const dynamic = "force-dynamic";

const REPO = "nturl/topsail-bridge";
const MEASURED_URL = `https://raw.githubusercontent.com/${REPO}/main/src/data/measured.json`;
const DISPATCH_URL = `https://api.github.com/repos/${REPO}/actions/workflows/poll.yml/dispatches`;
const MIN_GAP_MS = 25 * 60_000;
const HEADERS = { "Cache-Control": "no-store, max-age=0" };

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

export async function GET(req: NextRequest) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return reply({ status: "not configured" }, 503);

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return reply({ status: "unauthorized" }, 401);
  }

  try {
    const m = await fetch(MEASURED_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (m.ok) {
      const lastAt = Date.parse(((await m.json()) as { lastAt?: string }).lastAt ?? "");
      if (Number.isFinite(lastAt) && Date.now() - lastAt < MIN_GAP_MS) {
        return reply({ status: "skipped", reason: "fresh", lastAt: new Date(lastAt).toISOString() });
      }
    }
    // Unreadable freshness falls through to dispatch; poll.mjs has its own 25 min guard.

    const d = await fetch(DISPATCH_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "topsail-bridge-cron",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (d.status !== 204) return reply({ status: "dispatch failed", code: d.status }, 502);
    return reply({ status: "dispatched" });
  } catch {
    return reply({ status: "error" }, 502);
  }
}
