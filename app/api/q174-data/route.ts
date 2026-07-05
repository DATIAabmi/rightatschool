import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

const DISPLAY_NAMES: Record<string, string> = {
  Job_Function:    "Job Function",
  Total_Downloads: "Total Downloads",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign    = searchParams.get("campaign")    ?? "";
  const district    = searchParams.get("district")    ?? "";
  const state       = searchParams.get("state")       ?? "";
  const jobFunction = searchParams.get("jobFunction") ?? "";
  const dateStart   = searchParams.get("dateStart")   ?? "";
  const dateEnd     = searchParams.get("dateEnd")     ?? "";

  const parameters: object[] = [];

  if (campaign) parameters.push({
    id: "c045eb3b-8728-447b-a1de-9172b6c283f7",
    type: "string/=",
    value: campaign,
    target: ["variable", ["template-tag", "Abmi_Campaign"]],
  });
  if (district) parameters.push({
    id: "ccf5b48e-c422-4023-ab4e-09bd3c803f63",
    type: "string/=",
    value: district,
    target: ["variable", ["template-tag", "user_district"]],
  });
  if (state) parameters.push({
    id: "d34bd06f-fe6a-4d93-86f0-4be3b8fdb8df",
    type: "string/=",
    value: state,
    target: ["variable", ["template-tag", "state"]],
  });
  if (jobFunction) parameters.push({
    id: "86cfe99c-d9e4-4807-a511-6fc5ad2d7386",
    type: "string/=",
    value: jobFunction,
    target: ["variable", ["template-tag", "Job_Function"]],
  });
  if (dateStart) parameters.push({
    id: "04618b81-d06d-4227-a08b-7da50d59e85f",
    type: "date/range",
    value: dateStart,
    target: ["dimension", ["template-tag", "Last_Updated.start"]],
  });
  if (dateEnd) parameters.push({
    id: "9891e1ff-9b6d-496b-8871-1cbf96c4cd20",
    type: "date/range",
    value: dateEnd,
    target: ["dimension", ["template-tag", "Last_Updated.end"]],
  });

  const res = await fetch(`${METABASE_URL}/api/card/174/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({
    cols: (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.name] ?? c.display_name,
      base_type: c.base_type,
    })),
    rows: data.data?.rows ?? [],
  });
}
