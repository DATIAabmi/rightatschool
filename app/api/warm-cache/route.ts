import { NextResponse } from "next/server";

export const maxDuration = 60;

// Called by Vercel cron every 4 minutes to keep q405-data in-memory cache warm.
// Uses VERCEL_URL (set automatically by Vercel) for internal routing.
export async function GET() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const [r405, r425, r181, r180] = await Promise.all([
      fetch(`${base}/api/q405-data`, { cache: "no-store" }),
      fetch(`${base}/api/q425-data`, { cache: "no-store" }),
      fetch(`${base}/api/q181-data`, { cache: "no-store" }),
      fetch(`${base}/api/q180-data`, { cache: "no-store" }),
    ]);
    return NextResponse.json({
      q405: { ok: r405.ok },
      q425: { ok: r425.ok },
      q181: { ok: r181.ok },
      q180: { ok: r180.ok },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
