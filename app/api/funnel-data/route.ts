import { NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchScalar(cardId: number): Promise<string | number | null> {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: [] }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.data?.rows ?? [];
    return rows[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [impressions, impressionsGoal, engagements, ctr, engagedUsers, leads, leadsGoal] =
    await Promise.all([
      fetchScalar(319),
      fetchScalar(300),
      fetchScalar(320),
      fetchScalar(323),
      fetchScalar(308),
      fetchScalar(314),
      fetchScalar(305),
    ]);

  return NextResponse.json({
    impressions,
    impressionsGoal,
    engagements,
    ctr,
    engagedUsers,
    leads,
    leadsGoal,
  });
}
