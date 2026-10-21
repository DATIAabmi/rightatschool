import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";

interface PersonaRow {
  JobFunction: string;
  Users: number;
  Engagements: number;
  Leads: number;
}

interface BoardMinuteRow {
  SBMDate: string;
  Keyword: string;
  Context: string;
  Link: string;
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function runQuery(sql: string): Promise<{ cols: string[]; rows: unknown[][] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  let res: Response;
  try {
    res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: "native",
        native: { query: sql },
        middleware: { "js-int-to-string?": true },
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Metabase ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Query error: ${data.error}`);

  const cols: string[] = (data.data?.cols ?? []).map(
    (c: { display_name: string }) => c.display_name,
  );
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const district = searchParams.get("district") ?? "";
    if (!district) {
      return NextResponse.json({ persona: [], boardMinutes: [] });
    }

    const districtVal = sqlStr(district);

    const sqlPersona = `
SELECT
  job_title AS JobFunction,
  COUNT(DISTINCT engaged_user) AS Users,
  SUM(SAFE_CAST(engagements AS FLOAT64)) AS Engagements,
  COUNT(DISTINCT leads) AS Leads
FROM ${TABLE}
WHERE topic_district = ${districtVal}
  AND job_title IS NOT NULL AND job_title != ''
  AND SAFE_CAST(engagements AS FLOAT64) > 0
GROUP BY job_title
ORDER BY Engagements DESC`;

    const sqlBoard = `
SELECT
  e.SBM_Date AS SBMDate,
  e.curate_topic AS Keyword,
  e.SBM_Context AS Context,
  e.SBM_Link AS Link
FROM ${TABLE}, UNNEST(engagement) AS e
WHERE topic_district = ${districtVal}
  AND e.SBM_Date IS NOT NULL
  AND e.SBM_Link IS NOT NULL
ORDER BY e.SBM_Date DESC
LIMIT 20`;

    const [personaResult, boardResult] = await Promise.all([
      runQuery(sqlPersona),
      runQuery(sqlBoard),
    ]);

    const persona: PersonaRow[] = personaResult.rows.map((r) => {
      const obj: Record<string, unknown> = {};
      personaResult.cols.forEach((col, i) => { obj[col] = r[i]; });
      return {
        JobFunction: String(obj["JobFunction"] ?? ""),
        Users:       Number(obj["Users"] ?? 0),
        Engagements: Number(obj["Engagements"] ?? 0),
        Leads:       Number(obj["Leads"] ?? 0),
      };
    });

    const boardMinutes: BoardMinuteRow[] = boardResult.rows.map((r) => {
      const obj: Record<string, unknown> = {};
      boardResult.cols.forEach((col, i) => { obj[col] = r[i]; });
      return {
        SBMDate:  String(obj["SBMDate"] ?? ""),
        Keyword:  String(obj["Keyword"] ?? ""),
        Context:  String(obj["Context"] ?? ""),
        Link:     String(obj["Link"] ?? ""),
      };
    });

    return NextResponse.json({ persona, boardMinutes });
  } catch (err) {
    return NextResponse.json({ persona: [], boardMinutes: [], error: String(err) });
  }
}
