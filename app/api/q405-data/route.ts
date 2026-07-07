import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign = searchParams.get("campaign") ?? "";
  const district = searchParams.get("district") ?? "";
  const domain = searchParams.get("domain") ?? "";
  const state = searchParams.get("state") ?? "";

  const parameters: object[] = [];

  if (campaign) {
    parameters.push({
      id: "6ccf4539-6eb6-4a7c-b579-d315c59a66a0",
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "ABM_Campaign"]],
    });
  }
  if (district) {
    parameters.push({
      id: "6ed963e9-6e0f-4b96-a77d-678f5a84c1ea",
      type: "string/=",
      value: district,
      target: ["variable", ["template-tag", "District"]],
    });
  }
  if (domain) {
    parameters.push({
      id: "da615bcc-61b7-4cf0-b292-a407207ab2a1",
      type: "string/=",
      value: domain,
      target: ["variable", ["template-tag", "District_Domain"]],
    });
  }
  if (state) {
    parameters.push({
      id: "07116ece-9278-43d1-8388-cae6cd1c12af",
      type: "string/=",
      value: state,
      target: ["variable", ["template-tag", "State"]],
    });
  }

  const res = await fetch(`${METABASE_URL}/api/card/405/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();

  // Apply Metabase visualization_settings column_title overrides
  const DISPLAY_NAMES: Record<string, string> = {
    ST:          "State",
    Camp:        "Campaign",
    Down:        "Downloads",
    EngagedUser: "Engaged Users",
    UniqueLeads: "Leads",
  };

  return NextResponse.json({
    cols: (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    })),
    rows: data.data?.rows ?? [],
  });
}
