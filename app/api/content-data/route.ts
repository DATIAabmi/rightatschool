import { NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchCard(cardId: number) {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: [] }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.rows ?? [];
  } catch {
    return null;
  }
}

export async function GET() {
  const [rows200, rows201, rows202, rows203, rows204] = await Promise.all([
    fetchCard(200),
    fetchCard(201),
    fetchCard(202),
    fetchCard(203),
    fetchCard(204),
  ]);

  return NextResponse.json({
    impressions: rows200?.[0]?.[0] ?? null,
    clicks: rows201?.[0]?.[0] ?? null,
    ctr: rows202?.[0]?.[0] ?? null,
    channelBreakdown: rows203 ?? [],
    channelClicks: rows204 ?? [],
  });
}
