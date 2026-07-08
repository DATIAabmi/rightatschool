import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaign = searchParams.get("campaign") ?? "";
    const district = searchParams.get("district") ?? "";

    const parameters: object[] = [];

    if (campaign) parameters.push({
      id: "abmi_campaign_tag",
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "abmi_campaign"]],
    });

    if (district) parameters.push({
      id: "281aefcd-96a2-48db-b5bb-a9d3fa67e51c",
      type: "string/=",
      value: district,
      target: ["variable", ["template-tag", "District"]],
    });

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
    return NextResponse.json({
      cols: (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
        display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
        base_type: c.base_type,
      })),
      rows: data.data?.rows ?? [],
    });
  } catch {
    return NextResponse.json({ cols: [], rows: [] });
  }
}
