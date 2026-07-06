import { NextRequest, NextResponse } from "next/server";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaign  = searchParams.get("campaign")  ?? "";
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";

  const parameters: object[] = [];
  if (campaign) {
    parameters.push({
      type: "string/=",
      value: campaign,
      target: ["variable", ["template-tag", "Abmi_Campaign"]],
    });
  }
  if (dateStart && dateEnd) {
    parameters.push({
      type: "date/range",
      value: `${dateStart}~${dateEnd}`,
      target: ["dimension", ["template-tag", "date"]],
    });
  }

  const res = await fetch(`${METABASE_URL}/api/card/363/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Metabase error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ rows: data.data?.rows ?? [] });
}
