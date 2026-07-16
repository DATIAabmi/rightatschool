import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts = parseList(searchParams.get("district"));

    // Campaign/District are real per-row columns on this card, so multiple
    // selections are applied locally below instead of via Metabase — but the
    // card's abmi_campaign tag has a hardcoded default of just C5, so every
    // OTHER campaign's rows would never even get fetched unless we
    // explicitly override it with the full list of known campaigns.
    const parameters: object[] = [
      {
        type: "string/=",
        value: [...CAMPAIGNS],
        target: ["variable", ["template-tag", "abmi_campaign"]],
      },
    ];

    const res = await fetch(`${METABASE_URL}/api/card/425/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ parameters }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ cols: [], rows: [] });
    }

    const DISPLAY_NAMES: Record<string, string> = { ST: "State" };
    const data = await res.json();
    const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    }));
    let rows: unknown[][] = data.data?.rows ?? [];

    const districtCol = cols.findIndex((c: { display_name: string }) => c.display_name === "District");
    const campaignCol = cols.findIndex((c: { display_name: string }) => c.display_name === "Campaign");

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    rows = rows
      .filter(matches(campaigns, campaignCol))
      .filter(matches(districts, districtCol));

    return NextResponse.json({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
