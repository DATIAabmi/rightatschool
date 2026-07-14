import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

type Row = [string, number, number];

async function fetchRowsForCampaign(campaign: string, dateStart: string, dateEnd: string): Promise<Row[]> {
  const parameters: object[] = [];
  if (campaign) {
    parameters.push({
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart && dateEnd) {
    parameters.push({
      type: "date/range",
      value: `${dateStart}~${dateEnd}`,
      target: ["dimension", ["template-tag", "date"]],
    });
  }

  const res = await fetch(`${METABASE_URL}/api/card/363/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.rows ?? [];
}

function mergeRows(rowSets: Row[][]): Row[] {
  const totals = new Map<string, number>();
  for (const rows of rowSets) {
    for (const [label, count] of rows) {
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([label, count]): Row => [label, count, total > 0 ? count / total : 0])
    .sort((a, b) => b[1] - a[1]);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const dateStart = searchParams.get("dateStart") ?? "";
    const dateEnd   = searchParams.get("dateEnd")   ?? "";

    if (campaigns.length <= 1) {
      const rows = await fetchRowsForCampaign(campaigns[0] ?? "", dateStart, dateEnd);
      return NextResponse.json({ rows });
    }

    const perCampaign = await Promise.all(campaigns.map((c) => fetchRowsForCampaign(c, dateStart, dateEnd)));
    return NextResponse.json({ rows: mergeRows(perCampaign) });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 200 });
  }
}
