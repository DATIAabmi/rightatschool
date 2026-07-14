import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Camp:        "Campaign",
  Down:        "Downloads",
  EngagedUser: "Engaged Users",
  UniqueLeads: "Leads",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts = parseList(searchParams.get("district"));
    const domains   = parseList(searchParams.get("domain"));
    const states    = parseList(searchParams.get("state"));

    // Campaign/District/Domain/State are all real per-row columns on this
    // card, so multiple selections are applied locally below instead of
    // via Metabase (whose SQL variables only support a single value).
    const parameters: object[] = [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let res: Response;
    try {
      res = await fetch(`${METABASE_URL}/api/card/405/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ parameters }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return NextResponse.json({ cols: [], rows: [] });
    }

    const data = await res.json();
    const cols = (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    }));
    let rows: unknown[][] = data.data?.rows ?? [];

    const districtCol = cols.findIndex((c: { display_name: string }) => c.display_name === "District");
    const domainCol = cols.findIndex((c: { display_name: string }) => c.display_name === "Domain");
    const stateCol = cols.findIndex((c: { display_name: string }) => c.display_name === "State");
    const campaignCol = cols.findIndex((c: { display_name: string }) => c.display_name === "Campaign");
    const campaignShortCodes = campaigns.map((c) => c.split(":")[0].trim());

    const matches = (values: string[], colIdx: number) => (row: unknown[]) =>
      values.length === 0 || (colIdx >= 0 && values.some((v) => v.toLowerCase() === String(row[colIdx] ?? "").toLowerCase()));

    rows = rows
      .filter(matches(campaignShortCodes, campaignCol))
      .filter(matches(districts, districtCol))
      .filter(matches(domains, domainCol))
      .filter(matches(states, stateCol));

    return NextResponse.json({ cols, rows });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
