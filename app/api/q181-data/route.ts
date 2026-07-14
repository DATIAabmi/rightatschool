import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Topic_Score: "Topic Score",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = parseList(searchParams.get("campaign"));
  const districts = parseList(searchParams.get("district"));
  const states    = parseList(searchParams.get("state"));
  const topics    = parseList(searchParams.get("topic"));
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const parameters: object[] = [];

  // Campaign/district/state/topic are real per-row columns on this card, so
  // multiple selections are applied locally below instead of via Metabase.
  if (dateStart) parameters.push({
    id: "0b180445-b91a-4756-bdbe-6e7359010e64",
    type: "date/range",
    value: dateStart,
    target: ["dimension", ["template-tag", "Last_Updated.start"]],
  });
  if (dateEnd) parameters.push({
    id: "b8f52013-7d42-4379-9b14-8af571898b24",
    type: "date/range",
    value: dateEnd,
    target: ["dimension", ["template-tag", "Last_Updated.end"]],
  });

  const res = await fetch(`${METABASE_URL}/api/card/181/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const CAMPAIGN_COL = 2;
  const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
    display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
    base_type: c.base_type,
  }));
  let rows: unknown[][] = (data.data?.rows ?? []).map((row: unknown[]) =>
    row.map((val, j) =>
      j === CAMPAIGN_COL && typeof val === "string" ? val.split(":")[0].trim() : val
    )
  );

  const districtCol = cols.findIndex((c: { display_name: string }) => c.display_name === "District");
  const stateCol = cols.findIndex((c: { display_name: string }) => c.display_name === "State");
  const topicCol = cols.findIndex((c: { display_name: string }) => c.display_name === "Topic");
  const campaignShortCodes = campaigns.map((c) => c.split(":")[0].trim());

  const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
    values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

  rows = rows
    .filter(matches(campaignShortCodes, CAMPAIGN_COL))
    .filter(matches(districts, districtCol))
    .filter(matches(states, stateCol))
    .filter(matches(topics, topicCol));

  return NextResponse.json({ cols, rows });
}
