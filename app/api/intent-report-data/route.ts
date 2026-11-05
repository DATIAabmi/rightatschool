import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
const SIGNALS_TABLE = "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 30 * 60 * 1000;
// Bump when the SQL template changes so warm-lambda caches drop stale results.
const CACHE_VERSION = "ri-v4-split-by-domain";

interface DistrictRow {
  District: string;
  Domain: string;
  State: string;
  Campaign: string;
  Intel: string;          // legacy SBM_Y_N flag (kept for export + any consumers)
  AccountIntel: string;   // raw signals sheet match (org name OR shared domain)
  TopicInsights: string;  // Bombora topic data present in engagement array
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
  return `'${v.replace(/[\u2018\u2019\u201B]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
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

  // Scope signals the same way the main row is scoped by campaign, so Account
  // Intel reflects only signals tied to the campaigns currently in view. The
  // signals sheet's own column is `campaign`.
  const signalsWhere = campaigns.length
    ? `WHERE UPPER(TRIM(campaign)) IN (${campaigns.map((c) => sqlStr(c.toUpperCase())).join(", ")})`
    : "";

  // Same org-name normalization the per-district card uses: strip trailing
  // ", XX" state suffix and every apostrophe variant (Sheets autocorrects ' →
  // '), with plain REPLACE for the apostrophes to avoid regex class edge cases.
  const normalizeExpr = (col: string) =>
    `UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REGEXP_REPLACE(IFNULL(${col}, ''), r",\\s*[A-Z]{2}\\s*$", ""), "'", ""), "‘", ""), "’", ""), "\`", "")))`;

  const sql = `
WITH signals_orgs AS (
  SELECT DISTINCT ${normalizeExpr("organization")} AS org_up
  FROM ${SIGNALS_TABLE}
  ${signalsWhere}
),
signals_domains AS (
  SELECT DISTINCT LOWER(TRIM(domain)) AS dom
  FROM ${SIGNALS_TABLE}
  ${signalsWhere}${signalsWhere ? " AND " : "WHERE "}domain IS NOT NULL AND domain != ''
),
-- (district, domain) cohorts that have any Bombora topic data in their
-- engagement[] array — RAS has no separate Bombora table, so topics live
-- inside UNNEST(engagement).
topic_cohorts AS (
  SELECT DISTINCT topic_district AS district,
                  IFNULL(LOWER(TRIM(email_domain)), '') AS dom
  FROM ${TABLE}, UNNEST(engagement) AS e
  WHERE topic_district IS NOT NULL AND topic_district != ''
    AND e.bombora_score IS NOT NULL
    AND e.topics IS NOT NULL
    AND LOWER(TRIM(e.topics)) != 'null'
    AND TRIM(e.topics) != ''
),
agg AS (
  SELECT
    topic_district AS District,
    IFNULL(email_domain, '') AS Domain,
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
  WHERE ${where.join("\n    AND ")}
  GROUP BY topic_district, IFNULL(email_domain, '')
)
SELECT
  a.District, a.Domain, a.State, a.Campaign, a.Intel,
  IF(
    EXISTS (SELECT 1 FROM signals_orgs o WHERE o.org_up = ${normalizeExpr("a.District")})
    OR (a.Domain != '' AND LOWER(TRIM(a.Domain)) IN (SELECT dom FROM signals_domains)),
    'Y', 'N'
  ) AS AccountIntel,
  IF(
    EXISTS (SELECT 1 FROM topic_cohorts t
            WHERE t.district = a.District
              AND t.dom = IFNULL(LOWER(TRIM(a.Domain)), '')),
    'Y', 'N'
  ) AS TopicInsights,
  a.Engagements, a.EngagedUsers, a.Leads, a.IntentScore, a.Trend, a.LastActivity
FROM agg a
ORDER BY a.IntentScore DESC`;

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
      District:      String(obj["District"] ?? ""),
      Domain:        String(obj["Domain"] ?? ""),
      State:         String(obj["State"] ?? ""),
      Campaign:      String(obj["Campaign"] ?? ""),
      Intel:         String(obj["Intel"] ?? "N"),
      AccountIntel:  String(obj["AccountIntel"] ?? "N"),
      TopicInsights: String(obj["TopicInsights"] ?? "N"),
      Engagements:   Number(obj["Engagements"] ?? 0),
      EngagedUsers:  Number(obj["EngagedUsers"] ?? 0),
      Leads:         Number(obj["Leads"] ?? 0),
      IntentScore:   Number(obj["IntentScore"] ?? 0),
      Trend:         Number(obj["Trend"] ?? 0),
      LastActivity:  String(obj["LastActivity"] ?? ""),
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

    const cacheKey = JSON.stringify({ v: CACHE_VERSION, campaigns, states, dateStart, dateEnd });
    const nocache = searchParams.get("nocache") === "1";
    if (!nocache) {
      const cached = memCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cachedJson({ rows: cached.data });
      }
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
