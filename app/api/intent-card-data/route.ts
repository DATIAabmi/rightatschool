import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// Scoring/engagement table (BigQuery via Metabase native driver, DB 34).
const DB_ID = 34;
const SCORING_TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";

// Signals sheet (raw Google sheet synced into BigQuery). This is the ONE source
// of truth for Account Intelligence: articles, bids/RFPs, AND school board
// minutes (source = 'Minutes'). An earlier version pulled signals from the
// ai_signals Metabase table filtered by Client ID 11564; that table doesn't
// carry the Minutes-tagged rows, which is why Greenfield's SBMs were missing.
const SIGNALS_TABLE = "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";

interface PersonaRow {
  JobFunction: string;
  Users: number;
  Engagements: number;
  Leads: number;
}

interface SignalRow {
  Date: string;
  Category: string;
  Keywords: string;
  Source: string;
  Link: string;
  Analysis: string;
  SourceText: string;
  Strength: number;
}

interface TopicRow {
  Topic: string;
  Score: number;
  Date: string;
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

function asObj(cols: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  cols.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const district = searchParams.get("district") ?? "";
    if (!district) {
      return NextResponse.json({ persona: [], signals: [], topics: [] });
    }

    const districtVal = sqlStr(district);

    // Comma-separated campaign short codes like "C1,C7"; empty = no filter.
    const campaignParam = searchParams.get("campaign") ?? "";
    const campaignCodes = campaignParam
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    // Signals sheet uses the `campaign` column.
    const signalsCampaignFilter = campaignCodes.length > 0
      ? `AND UPPER(TRIM(campaign)) IN (${campaignCodes.map((c) => sqlStr(c.toUpperCase())).join(", ")})`
      : "";
    // Scoring table uses `abm_campaign`. The parent Intent Report row filters
    // on this, so without it here persona/topics double-count users who appear
    // in multiple campaigns (one scoring row per campaign per user).
    const scoringCampaignFilter = campaignCodes.length > 0
      ? `AND abm_campaign IN (${campaignCodes.map((c) => sqlStr(c.toUpperCase())).join(", ")})`
      : "";

    // Persona uses the SAME aggregation shape as the parent row (COUNT of
    // engaged rows and SUM of engagements), so summing the card reconciles
    // against the KPI strip at the top of the Intent Report. Rows with no
    // job_title still contribute under the "Unknown" bucket.
    const sqlPersona = `
SELECT
  COALESCE(NULLIF(job_title, ''), 'Unknown') AS JobFunction,
  COUNT(CASE WHEN SAFE_CAST(engagements AS FLOAT64) > 0 THEN 1 END) AS Users,
  SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(NULLIF(CAST(leads AS STRING), '')) AS Leads
FROM ${SCORING_TABLE}
WHERE topic_district = ${districtVal}
  ${scoringCampaignFilter}
GROUP BY JobFunction
HAVING Users > 0 OR Engagements > 0 OR Leads > 0
ORDER BY Engagements DESC, Leads DESC`;

    // Bombora topics live inside UNNEST(engagement). Composite score is 0–100.
    const sqlTopics = `
SELECT
  item.topics AS Topic,
  MAX(SAFE_CAST(item.bombora_score AS INT64)) AS Score,
  FORMAT_DATE('%Y-%m-%d', MAX(DATE(sc.date_max_for_intent_scoring))) AS Date
FROM ${SCORING_TABLE} AS sc, UNNEST(sc.engagement) AS item
WHERE sc.topic_district = ${districtVal}
  ${scoringCampaignFilter.replace(/abm_campaign/g, "sc.abm_campaign")}
  AND item.bombora_score IS NOT NULL
  AND item.topics IS NOT NULL
  AND LOWER(TRIM(item.topics)) != 'null'
  AND TRIM(item.topics) != ''
GROUP BY item.topics
ORDER BY Score DESC
LIMIT 15`;

    // Account intel from the Right At School signals sheet. Mirrors the Extron
    // pattern: normalize both sides (strip trailing state suffix + apostrophe
    // variants), and ALSO match on ANY distinct email_domain the scoring table
    // has for this district — so "Greenfield Union School District" (scoring)
    // matches sheet rows whose organization is "Greenfield Union Elementary
    // School District" or "Greenfield Union" when they share gfusd.net.
    const normalizeExpr = (col: string) =>
      `UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(${col}), r",\\s*[A-Z]{2}\\s*$", ""), r"['‘’\\x60]", ""))`;

    const sqlSignals = `
WITH doms AS (
  SELECT DISTINCT email_domain AS d FROM ${SCORING_TABLE}
  WHERE topic_district = ${districtVal}
    AND email_domain IS NOT NULL AND email_domain != ''
)
SELECT
  date           AS Date,
  category       AS Category,
  keywords       AS Keywords,
  source         AS Source,
  source_link    AS Link,
  signal_analysis AS Analysis,
  SAFE_CAST(strength AS INT64) AS Strength
FROM ${SIGNALS_TABLE}
WHERE (${normalizeExpr("organization")} = ${normalizeExpr(districtVal)}
       OR LOWER(TRIM(domain)) IN (SELECT LOWER(TRIM(d)) FROM doms))
  ${signalsCampaignFilter}
ORDER BY SAFE_CAST(strength AS INT64) DESC, date DESC
LIMIT 25`;

    const [personaResult, topicsResult, signalsResult] = await Promise.all([
      runQuery(sqlPersona),
      runQuery(sqlTopics).catch(() => ({ cols: [], rows: [] })),
      runQuery(sqlSignals).catch(() => ({ cols: [], rows: [] })),
    ]);

    const persona: PersonaRow[] = personaResult.rows.map((r) => {
      const o = asObj(personaResult.cols, r);
      return {
        JobFunction: String(o["JobFunction"] ?? ""),
        Users:       Number(o["Users"] ?? 0),
        Engagements: Number(o["Engagements"] ?? 0),
        Leads:       Number(o["Leads"] ?? 0),
      };
    });

    const topics: TopicRow[] = topicsResult.rows.map((r) => {
      const o = asObj(topicsResult.cols, r);
      return {
        Topic: String(o["Topic"] ?? ""),
        Score: Number(o["Score"] ?? 0),
        Date:  String(o["Date"] ?? ""),
      };
    });

    const signals: SignalRow[] = signalsResult.rows.map((r) => {
      const o = asObj(signalsResult.cols, r);
      return {
        Date:       String(o["Date"] ?? ""),
        Category:   String(o["Category"] ?? ""),
        Keywords:   String(o["Keywords"] ?? ""),
        Source:     String(o["Source"] ?? ""),
        Link:       String(o["Link"] ?? ""),
        Analysis:   String(o["Analysis"] ?? ""),
        SourceText: "",
        Strength:   Number(o["Strength"] ?? 0),
      };
    });

    return NextResponse.json({ persona, signals, topics });
  } catch (err) {
    return NextResponse.json({ persona: [], signals: [], topics: [], error: String(err) });
  }
}
