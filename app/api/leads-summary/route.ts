import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

async function fetchCard(cardId: number, params: object[]) {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: params }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.rows ?? null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign = searchParams.get("campaign") ?? "";
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd = searchParams.get("dateEnd") ?? "";

  const params: object[] = [];
  if (campaign) params.push({ type: "string/=", value: campaign, target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart) params.push({ type: "date/range", value: dateStart, target: ["variable", ["template-tag", "Last_Updated.start"]] });
  if (dateEnd) params.push({ type: "date/range", value: dateEnd, target: ["variable", ["template-tag", "Last_Updated.end"]] });

  const [r175, r176, r177, r178, r179] = await Promise.all([
    fetchCard(175, params),
    fetchCard(176, params),
    fetchCard(177, params),
    fetchCard(178, params),
    fetchCard(179, params),
  ]);

  return NextResponse.json({
    totalDownloads:     r175?.[0]?.[0] ?? null,
    totalUniqueLeads:   r176?.[0]?.[0] ?? null,
    uniqueLeadDistrict: r177?.[0]?.[0] ?? null,
    byContentType: (r178 ?? []) as [string, number][],
    byContentName: (r179 ?? []) as [string, number][],
  });
}
