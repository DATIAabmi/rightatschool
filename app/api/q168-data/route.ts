import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateStart   = searchParams.get("dateStart") ?? "";
  const dateEnd     = searchParams.get("dateEnd") ?? "";
  const district    = searchParams.get("district") ?? "";
  const state       = searchParams.get("state") ?? "";
  const jobFunction = searchParams.get("jobFunction") ?? "";

  const parameters: object[] = [];

  if (dateStart) parameters.push({
    id: "91b942bb-02e7-4128-bd8e-ff29fb6bd7d9",
    type: "date/range",
    value: dateStart,
    target: ["dimension", ["template-tag", "Last_Updated.start"]],
  });
  if (dateEnd) parameters.push({
    id: "d4d6bd60-ce65-4055-ad2d-c9403ba42401",
    type: "date/range",
    value: dateEnd,
    target: ["dimension", ["template-tag", "Last_Updated.end"]],
  });
  if (district) parameters.push({
    id: "12a0e3ec-5c50-4329-8695-72662429abc8",
    type: "string/=",
    value: district,
    target: ["variable", ["template-tag", "user_district"]],
  });
  if (state) parameters.push({
    id: "f941cdb5-155d-48d1-b5d7-16215819abff",
    type: "string/=",
    value: state,
    target: ["variable", ["template-tag", "state"]],
  });
  if (jobFunction) parameters.push({
    id: "bb5bfb7a-0818-42c8-bc4e-e0d37a97d558",
    type: "string/=",
    value: jobFunction,
    target: ["variable", ["template-tag", "Job_Function"]],
  });

  const res = await fetch(`${METABASE_URL}/api/card/168/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const normalizeColName = (name: string, displayName: string): string => {
    const key = name.toLowerCase();
    if (key === "job_function") return "Job Function";
    if (key.includes("district") && key.includes("domain")) return "District Domain";
    if (displayName.toLowerCase().includes("district") && displayName.toLowerCase().includes("domain")) return "District Domain";
    return displayName;
  };
  return NextResponse.json({
    cols: (data.data?.cols ?? []).map((c: { name: string; display_name: string; base_type: string }) => ({
      display_name: normalizeColName(c.name, c.display_name),
      base_type: c.base_type,
    })),
    rows: data.data?.rows ?? [],
  });
}
