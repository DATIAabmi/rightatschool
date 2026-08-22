import { NextRequest, NextResponse } from "next/server"; // NextResponse used for error response
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const params: object[] = [];
  // Pass all campaigns at once so Card 205's GROUP BY returns each asset once
  // with impressions/clicks summed across all selected campaigns.
  if (campaigns.length > 0) params.push({ id: "campaign", type: "string/=", value: campaigns, target: ["variable", ["template-tag", "Abmi_Campaign"]] });
  if (dateStart) params.push({ id: "date_start", type: "date/range", value: dateStart, target: ["variable", ["template-tag", "Date"]] });
  if (dateEnd)   params.push({ id: "date_end",   type: "date/range", value: dateEnd,   target: ["variable", ["template-tag", "Date"]] });

  const res = await fetch(`${METABASE_URL}/api/card/205/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: params }),
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json({ error: "Metabase error" }, { status: 500 });
  const data = await res.json();
  const rows: unknown[][] = data.data?.rows ?? [];

  // Filter out rows where the asset link (col 2) is missing or returns a non-200
  // status. Checks run concurrently; result is cached by the CDN so the HTTP
  // probes only fire once per hour per unique campaign/date combination.
  const LINK_COL = 2;
  async function linkOk(url: unknown): Promise<boolean> {
    if (!url || typeof url !== "string" || !url.startsWith("http")) return false;
    try {
      const r = await fetch(url, { method: "HEAD", redirect: "follow" });
      return r.ok;
    } catch {
      return false;
    }
  }

  const ok = await Promise.all(rows.map((row) => linkOk(row[LINK_COL])));
  const validRows = rows.filter((_, i) => ok[i]);

  return cachedJson({ rows: validRows });
}
