import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
// Signals sheet — the SAME source the expanded card uses. The Intel Y/N flag
// should reflect "does this district have any account intel on file" (articles,
// RFPs, board minutes, etc.), not the old scoring-table SBM_Y_N bit which only
// tracks board minutes embedded in a user's engagement array.
const SIGNALS_TABLE = "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";
const NORMALIZE_EXPR = (col: string) =>
  `UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(${col}), r",\\s*[A-Z]{2}\\s*$", ""), r"['‘’\\x60]", ""))`;

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

  // Prefix every scoring-table where clause with the alias used below.
  const scopedWhere = where.map((w) => w.replace(/\b(topic_district|email_domain|state|abm_campaign|date_max_for_intent_scoring)\b/g, "sc.$1"));

  // intel_districts: the set of districts the signals sheet has any row for,
  // matched by normalized organization name OR shared email domain. Greenfield
  // Union School District (scoring) matches "Greenfield Union Elementary School
  // District" / "Greenfield Union" (sheet) via gfusd.net.
  const sql = `
WITH
district_lookup AS (
  SELECT DISTINCT topic_district AS district, email_domain AS domain
  FROM ${TABLE}
  WHERE topic_district IS NOT NULL AND topic_district != ''
),
intel_districts AS (
  SELECT DISTINCT dl.district
  FROM district_lookup dl
  JOIN ${SIGNALS_TABLE} s
    ON ${NORMALIZE_EXPR("s.organization")} = ${NORMALIZE_EXPR("dl.district")}
    OR (dl.domain IS NOT NULL AND dl.domain != ''
        AND LOWER(TRIM(s.domain)) = LOWER(TRIM(dl.domain)))
)
SELECT
  sc.topic_district AS District,
  ANY_VALUE(sc.email_domain) AS Domain,
  ANY_VALUE(sc.state) AS State,
  ANY_VALUE(CONCAT('C', CAST(sc.abm_campaign_num AS STRING))) AS Campaign,
  IF(MAX(IF(id.district IS NOT NULL, 1, 0)) = 1, 'Y', 'N') AS Intel,
  SUM(IFNULL(SAFE_CAST(sc.engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(CASE WHEN SAFE_CAST(sc.engagements AS FLOAT64) > 0 THEN 1 ELSE NULL END) AS EngagedUsers,
  COUNT(NULLIF(CAST(sc.leads AS STRING), '')) AS Leads,
  SUM(IFNULL(SAFE_CAST(sc.cumulative_score AS FLOAT64), 0)) AS IntentScore,
  SUM(IFNULL(SAFE_CAST(sc.cumulative_score_trend AS FLOAT64), 0)) AS Trend,
  FORMAT_DATE('%Y-%m-%d', MAX(DATE(sc.date_max_for_intent_scoring))) AS LastActivity
FROM ${TABLE} sc
LEFT JOIN intel_districts id ON id.district = sc.topic_district
WHERE ${scopedWhere.join("\n  AND ")}
GROUP BY sc.topic_district
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
