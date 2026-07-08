import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

function buildParams(campaign: string, dateStart: string, dateEnd: string): object[] {
  const params: object[] = [];
  if (campaign) {
    params.push({
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart && dateEnd) {
    params.push({
      type: "date/range",
      value: `${dateStart}~${dateEnd}`,
      target: ["dimension", ["template-tag", "date"]],
    });
  }
  return params;
}

async function fetchScalar(cardId: number, params: object[]): Promise<string | number | null> {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: params }),
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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign  = searchParams.get("campaign")  ?? "";
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const params = buildParams(campaign, dateStart, dateEnd);

  const [impressions, engagements, ctr, engagedUsers, leads] =
    await Promise.all([
      fetchScalar(319, params),
      fetchScalar(320, params),
      fetchScalar(323, params),
      fetchScalar(308, params),
      fetchScalar(314, params),
    ]);

  return NextResponse.json({ impressions, engagements, ctr, engagedUsers, leads });
}
