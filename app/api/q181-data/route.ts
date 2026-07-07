import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Topic_Score: "Topic Score",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign  = searchParams.get("campaign")  ?? "";
  const district  = searchParams.get("district")  ?? "";
  const state     = searchParams.get("state")     ?? "";
  const topic     = searchParams.get("topic")     ?? "";
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const parameters: object[] = [];

  if (campaign) parameters.push({
    id: "ccf5f7d1-8f1a-474d-b273-edeed2dd54dc",
    type: "string/=",
    value: campaign,
    target: ["variable", ["template-tag", "Abmi_Campaign"]],
  });
  if (district) parameters.push({
    id: "34b78ce0-e544-416e-8a09-ddc57ec0504a",
    type: "string/=",
    value: district,
    target: ["variable", ["template-tag", "user_district"]],
  });
  if (state) parameters.push({
    id: "f8e34e5a-ff7c-4b73-976e-d347f625a8c8",
    type: "string/=",
    value: state,
    target: ["variable", ["template-tag", "state"]],
  });
  if (topic) parameters.push({
    id: "c1a88312-042c-40f4-b942-9ea74706d81c",
    type: "string/=",
    value: topic,
    target: ["variable", ["template-tag", "Topic"]],
  });
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
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const CAMPAIGN_COL = 2;
  return NextResponse.json({
    cols: (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    })),
    rows: (data.data?.rows ?? []).map((row: unknown[]) =>
      row.map((val, j) =>
        j === CAMPAIGN_COL && typeof val === "string" ? val.split(":")[0].trim() : val
      )
    ),
  });
}
