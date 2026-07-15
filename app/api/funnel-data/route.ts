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
      target: ["dimension", ["template-tag", "Date"]],
    });
  }
  return params;
}

// Card 314 (Leads) uses a BigQuery UNNEST query — Metabase's auto-generated
// field-filter SQL doesn't resolve correctly against that join, so this card
// takes two plain date variables instead of the shared Date range dimension.
function buildLeadsParams(campaign: string, dateStart: string, dateEnd: string): object[] {
  const params: object[] = [];
  if (campaign) {
    params.push({
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart) {
    params.push({
      type: "date/single",
      value: dateStart,
      target: ["variable", ["template-tag", "start_date"]],
    });
  }
  if (dateEnd) {
    params.push({
      type: "date/single",
      value: dateEnd,
      target: ["variable", ["template-tag", "end_date"]],
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

function sum(values: (string | number | null)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

// ctr scalars come back pre-formatted (e.g. "1.72%"), so strip non-numeric
// characters before averaging, then re-format to match that same shape.
function avgPct(values: (string | number | null)[]): string | null {
  const nums = values
    .map((v) => (typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v)))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return `${avg.toFixed(2)}%`;
}

async function fetchFunnelForCampaign(campaign: string, dateStart: string, dateEnd: string) {
  const params = buildParams(campaign, dateStart, dateEnd);
  const leadsParams = buildLeadsParams(campaign, dateStart, dateEnd);
  const [impressions, engagements, ctr, engagedUsers, leads] =
    await Promise.all([
      fetchScalar(319, params),
      fetchScalar(320, params),
      fetchScalar(323, params),
      fetchScalar(308, params),
      fetchScalar(314, leadsParams),
    ]);
  return { impressions, engagements, ctr, engagedUsers, leads };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  if (campaigns.length <= 1) {
    const result = await fetchFunnelForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
    return NextResponse.json(result);
  }

  const perCampaign = await Promise.all(campaigns.map((c) => fetchFunnelForCampaign(c, dateStart, dateEnd)));
  return NextResponse.json({
    impressions:  sum(perCampaign.map((r) => r.impressions)),
    engagements:  sum(perCampaign.map((r) => r.engagements)),
    ctr:          avgPct(perCampaign.map((r) => r.ctr)),
    engagedUsers: sum(perCampaign.map((r) => r.engagedUsers)),
    leads:        sum(perCampaign.map((r) => r.leads)),
  });
}
