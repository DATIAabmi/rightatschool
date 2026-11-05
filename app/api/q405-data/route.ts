import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { assetFilterClause } from "@/lib/assetFilter";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
// Account Intelligence source — the raw signals sheet. Intel = Y is
// recomputed from this so it only lights up when the AI Feed has rows
// to show for the district (match on normalized org name OR shared
// email_domain, same rule the Intent Report uses).
const SIGNALS_TABLE =
  "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";

// Maps SQL alias → display name shown in the UI
const DISPLAY_NAMES: Record<string, string> = {
  ST:          "State",
  Camp:        "Campaign",
  Down:        "Downloads",
  EngagedUser: "Engaged Users",
  UniqueLeads: "Leads",
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/[\u2018\u2019\u201B]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// Cache keyed on all filter params — campaign filter changes the aggregated Score Trend
const CACHE_TTL_MS = 30 * 60 * 1000;
const memCache = new Map<string, { data: { cols: unknown[]; rows: unknown[][] }; ts: number }>();
const inflight = new Map<string, Promise<{ cols: unknown[]; rows: unknown[][] }>>();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function fetchData(
  campaigns: string[],
  districts: string[],
  domains: string[],
  states: string[],
  assets: string[],
  dateStart: string,
  dateEnd: string,
): Promise<{ cols: unknown[]; rows: unknown[][] }> {
  const where: string[] = [
    "topic_district IS NOT NULL",
    "topic_district != ''",
  ];

  // Page sends short codes ("C7"); abm_campaign stores short codes
  if (campaigns.length) where.push(`abm_campaign IN (${campaigns.map(sqlStr).join(", ")})`);
  if (districts.length) where.push(`topic_district IN (${districts.map(sqlStr).join(", ")})`);
  if (domains.length)   where.push(`email_domain IN (${domains.map(sqlStr).join(", ")})`);
  if (states.length)    where.push(`state IN (${states.map(sqlStr).join(", ")})`);
  const assetClause = assetFilterClause(assets);
  if (assetClause) where.push(assetClause);
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(date_max_for_intent_scoring) BETWEEN '${dateStart}' AND '${dateEnd}'`);
  }

  // Scope signals to the same campaigns we're viewing so Intel reflects
  // only signals tied to those campaigns (matches Intent Report).
  const signalsWhere = campaigns.length
    ? `WHERE UPPER(TRIM(campaign)) IN (${campaigns.map((c) => sqlStr(c.toUpperCase())).join(", ")})`
    : "";

  // Org-name normalization: strip trailing ", XX" state suffix and
  // every apostrophe variant so "Alief ISD" matches "Alief ISD, TX".
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
agg AS (
  SELECT
    topic_district AS District,
    ANY_VALUE(email_domain) AS Domain,
    ARRAY_AGG(DISTINCT NULLIF(LOWER(TRIM(email_domain)), '') IGNORE NULLS) AS Domains,
    ANY_VALUE(state) AS ST,
    ANY_VALUE(CONCAT('C', CAST(abm_campaign_num AS STRING))) AS Camp,
    IF(MAX(CASE WHEN topic_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS Topic,
    SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
    COUNT(CASE WHEN SAFE_CAST(engagements AS FLOAT64) > 0 THEN 1 ELSE NULL END) AS EngagedUser,
    COUNT(NULLIF(CAST(leads AS STRING), '')) AS UniqueLeads,
    SUM(IFNULL(SAFE_CAST(downloads AS FLOAT64), 0)) AS Down,
    SUM(IFNULL(SAFE_CAST(cumulative_score AS FLOAT64), 0)) AS \`Intent Score\`,
    SUM(IFNULL(SAFE_CAST(cumulative_score_trend AS FLOAT64), 0)) AS \`Score Trend\`
  FROM ${TABLE}
  WHERE ${where.join("\n    AND ")}
  GROUP BY topic_district
)
SELECT
  a.District, a.Domain, a.ST, a.Camp,
  IF(
    EXISTS (SELECT 1 FROM signals_orgs    o WHERE o.org_up = ${normalizeExpr("a.District")})
    OR EXISTS (SELECT 1 FROM signals_domains d WHERE d.dom IN UNNEST(a.Domains)),
    'Y', 'N'
  ) AS Intel,
  a.Topic, a.Engagements, a.EngagedUser, a.UniqueLeads, a.Down,
  a.\`Intent Score\`, a.\`Score Trend\`
FROM agg a
ORDER BY a.\`Intent Score\` DESC`;

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

  const cols = (data.data?.cols ?? []).map(
    (c: { display_name: string; base_type: string }) => ({
      display_name: DISPLAY_NAMES[c.display_name] ?? c.display_name,
      base_type: c.base_type,
    }),
  );
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const campaigns = parseList(searchParams.get("campaign"));
    const districts = parseList(searchParams.get("district"));
    const domains   = parseList(searchParams.get("domain"));
    const states    = parseList(searchParams.get("state"));
    const assets    = parseList(searchParams.get("asset"));
    const dateStart = searchParams.get("dateStart") ?? "";
    const dateEnd   = searchParams.get("dateEnd")   ?? "";

    const cacheKey = JSON.stringify({ campaigns, districts, domains, states, assets, dateStart, dateEnd });
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cachedJson(cached.data);
    }

    if (!inflight.has(cacheKey)) {
      const p = fetchData(campaigns, districts, domains, states, assets, dateStart, dateEnd)
        .then((result) => {
          memCache.set(cacheKey, { data: result, ts: Date.now() });
          inflight.delete(cacheKey);
          return result;
        })
        .catch((err) => {
          inflight.delete(cacheKey);
          throw err;
        });
      inflight.set(cacheKey, p);
    }

    const { cols, rows } = await inflight.get(cacheKey)!;
    return cachedJson({ cols, rows });
  } catch (err) {
    return NextResponse.json({ cols: [], rows: [], error: String(err) });
  }
}
