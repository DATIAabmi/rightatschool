import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchCard(cardId: number, params: object[]) {
  try {
    const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters: params }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.rows ?? [];
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign  = searchParams.get("campaign")  ?? "";
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const params: object[] = [];
  if (campaign)  params.push({ type: "string/=",   value: campaign,  target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart) params.push({ type: "date/range",  value: dateStart, target: ["variable", ["template-tag", "Date"]] });
  if (dateEnd)   params.push({ type: "date/range",  value: dateEnd,   target: ["variable", ["template-tag", "Date"]] });

  const [rows200, rows201, rows202, rows203, rows204] = await Promise.all([
    fetchCard(200, params),
    fetchCard(201, params),
    fetchCard(202, params),
    fetchCard(203, params),
    fetchCard(204, params),
  ]);

  return NextResponse.json({
    impressions:      rows200?.[0]?.[0] ?? null,
    clicks:           rows201?.[0]?.[0] ?? null,
    ctr:              rows202?.[0]?.[0] ?? null,
    channelBreakdown: rows203 ?? [],
    channelClicks:    rows204 ?? [],
  });
}
