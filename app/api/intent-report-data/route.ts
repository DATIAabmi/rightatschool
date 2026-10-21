import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface DistrictRow {
  District: string;
  Domain: string;
  State: string;
  Campaign: string;
  Intel: string;
  Engagements: number;
  EngagedUsers: number;
  Leads: number;
  IntentScore: number;
  Trend: number;
  LastActivity: string;
}

const memCache = new Map<string, { data: DistrictRow[]; ts: number }>();
const inflight = new Map<string, Promise<DistrictRow[]>>();

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function fetchData(
  campaigns: string[],
  states: string[],
  dateStart: string,
  dateEnd: string,
): Promise<DistrictRow[]> {
  const where: string[] = [
    "topic_district IS NOT NULL",
    "topic_district != ''",
  ];

  if (campaigns.length) where.push(`abm_campaign IN (${campaigns.map(sqlStr).join(", ")})`);
  if (states.length) where.push(`state IN (${states.map(sqlStr).join(", ")})`);
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(date_max_for_intent_scoring) BETWEEN '${dateStart}' AND '${dateEnd}'`);
  }

  const sql = `
SELECT
  topic_district AS District,
  ANY_VALUE(email_domain) AS Domain,
  ANY_VALUE(state) AS State,
  ANY_VALUE(CONCAT('C', CAST(abm_campaign_num AS STRING))) AS Campaign,
  IF(MAX(CASE WHEN SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS Intel,
  SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(CASE WHEN SAFE_CAST(engagements AS FLOAT64) > 0 THEN 1 ELSE NULL END) AS EngagedUsers,
  COUNT(NULLIF(CAST(leads AS STRING), '')) AS Leads,
  SUM(IFNULL(SAFE_CAST(cumulative_score AS FLOAT64), 0)) AS IntentScore,
  SUM(IFNULL(SAFE_CAST(cumulative_score_trend AS FLOAT64), 0)) AS Trend,
  FORMAT_DATE('%Y-%m-%d', MAX(DATE(date_max_for_intent_scoring))) AS LastActivity
FROM ${TABLE}
WHERE ${where.join("\n  AND ")}
GROUP BY topic_district
ORDER BY IntentScore DESC`;

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
  const rawRows: unknown[][] = data.data?.rows ?? [];

  return rawRows.map((r) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => { obj[col] = r[i]; });
    return {
      District:     String(obj["District"] ?? ""),
      Domain:       String(obj["Domain"] ?? ""),
      State:        String(obj["State"] ?? ""),
      Campaign:     String(obj["Campaign"] ?? ""),
      Intel:        String(obj["Intel"] ?? "N"),
      Engagements:  Number(obj["Engagements"] ?? 0),
      EngagedUsers: Number(obj["EngagedUsers"] ?? 0),
      Leads:        Number(obj["Leads"] ?? 0),
      IntentScore:  Number(obj["IntentScore"] ?? 0),
      Trend:        Number(obj["Trend"] ?? 0),
      LastActivity: String(obj["LastActivity"] ?? ""),
    } satisfies DistrictRow;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const states    = parseList(searchParams.get("state"));
    const dateStart = searchParams.get("dateStart") ?? "";
    const dateEnd   = searchParams.get("dateEnd")   ?? "";

    const cacheKey = JSON.stringify({ campaigns, states, dateStart, dateEnd });
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cachedJson({ rows: cached.data });
    }

    if (!inflight.has(cacheKey)) {
      const p = fetchData(campaigns, states, dateStart, dateEnd)
        .then((rows) => {
          memCache.set(cacheKey, { data: rows, ts: Date.now() });
          inflight.delete(cacheKey);
          return rows;
        })
        .catch((err) => {
          inflight.delete(cacheKey);
          throw err;
        });
      inflight.set(cacheKey, p);
    }

    const rows = await inflight.get(cacheKey)!;
    return cachedJson({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: String(err) });
  }
}
