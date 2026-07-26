import { NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel cron every 4 minutes to keep q405-data in-memory cache warm.
// Uses VERCEL_URL (set automatically by Vercel) for internal routing.
export async function GET() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const start = Date.now();
  try {
    const res = await fetch(`${base}/api/q405-data`, { cache: "no-store" });
    const elapsed = Date.now() - start;
    return NextResponse.json({ ok: res.ok, elapsed, cached: elapsed < 800 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
