import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Metabase caps a single /api/dataset call at 10,000 rows, so page with LIMIT/OFFSET
// (same approach as q181-data).
const PAGE_SIZE = 10000;
const MAX_PAGES = 10;

// Intent Report tab: one payload with everything the page needs, joined client-side
// on lower-cased district name.
//   districts: [District, Domain, State, Campaigns, SBM, Engagements, EngagedUsers, Leads, Downloads, IntentScore, ScoreTrend, LastUpdated]
//   personas:  [District, JobFunction, Engagements, Leads]
//   topics:    [District, Topic, TopicScore, Date]
//   signals:   [District, Date, Keyword, Context, Link]
type Payload = {
  districts: unknown[][];
  personas: unknown[][];
  topics: unknown[][];
  signals: unknown[][];
};

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function toCampaignNum(c: string): number | null {
  const n = parseInt(c.split(":")[0].replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

async function runPaged(baseSql: string): Promise<unknown[][]> {
  const all: unknown[][] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${METABASE_URL}/api/dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        database: DB_ID,
        type: "native",
        native: { query: `${baseSql}\nLIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}` },
        middleware: { "js-int-to-string?": true },
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Metabase error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(String(data.error));
    const rows: unknown[][] = data.data?.rows ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

async function fetchPayload(campaignNums: number[], dateStart: string, dateEnd: string): Promise<Payload> {
  const base: string[] = ["sc.topic_district IS NOT NULL", "TRIM(sc.topic_district) != ''"];
  if (campaignNums.length) base.push(`sc.abm_campaign_num IN (${campaignNums.join(",")})`);
  const hasRange = DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd);
  // User-level activity is dated by last_updated, as on the other tabs.
  const activity = hasRange
    ? [...base, `SAFE_CAST(sc.last_updated AS DATE) BETWEEN '${dateStart}' AND '${dateEnd}'`]
    : base;

  // Engaged users = distinct engaged_user, matching Geo Insights (q169). Counting rows
  // instead (as q405 does) also counts persona rows with no engagement.
  const districtsSql = `
SELECT
  sc.topic_district AS District,
  ANY_VALUE(sc.email_domain) AS Domain,
  ANY_VALUE(sc.state) AS State,
  STRING_AGG(DISTINCT CONCAT('C', CAST(sc.abm_campaign_num AS STRING)), ',') AS Campaigns,
  IF(MAX(CASE WHEN sc.SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS SBM,
  SUM(IFNULL(SAFE_CAST(sc.engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(DISTINCT sc.engaged_user) AS EngagedUsers,
  COUNT(NULLIF(CAST(sc.leads AS STRING), '')) AS Leads,
  SUM(IFNULL(SAFE_CAST(sc.downloads AS FLOAT64), 0)) AS Downloads,
  SUM(IFNULL(SAFE_CAST(sc.cumulative_score AS FLOAT64), 0)) AS IntentScore,
  SUM(IFNULL(SAFE_CAST(sc.cumulative_score_trend AS FLOAT64), 0)) AS ScoreTrend,
  CAST(MAX(SAFE_CAST(sc.last_updated AS DATE)) AS STRING) AS LastUpdated
FROM ${TABLE} sc
WHERE ${activity.join("\n  AND ")}
GROUP BY sc.topic_district
ORDER BY IntentScore DESC, District`;

  const personasSql = `
SELECT
  sc.topic_district AS District,
  sc.job_title AS JobFunction,
  SUM(IFNULL(SAFE_CAST(sc.engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(NULLIF(CAST(sc.leads AS STRING), '')) AS Leads
FROM ${TABLE} sc
WHERE ${[...activity, "sc.job_title IS NOT NULL", "TRIM(sc.job_title) != ''"].join("\n  AND ")}
GROUP BY sc.topic_district, sc.job_title
HAVING Engagements > 0 OR Leads > 0
ORDER BY District, Engagements DESC, JobFunction`;

  // Topic surges (same source and date handling as q181-data).
  const topicsSql = `
SELECT
  sc.topic_district AS District,
  item.topics AS Topic,
  MAX(item.bombora_score) AS TopicScore,
  SUBSTR(CAST(MAX(sc.date_max_for_intent_scoring) AS STRING), 1, 10) AS Date
FROM ${TABLE} AS sc
CROSS JOIN UNNEST(sc.engagement) AS item
WHERE ${[
    ...activity,
    "item.bombora_score IS NOT NULL",
    "item.topics IS NOT NULL",
    "LOWER(TRIM(item.topics)) != 'null'",
    "TRIM(item.topics) != ''",
  ].join("\n  AND ")}
GROUP BY sc.topic_district, item.topics
ORDER BY District, TopicScore DESC, Topic`;

  // School board minutes (same source as q425-data), dated by the meeting date.
  const signalFilters = [...base, "e.SBM_Date IS NOT NULL", "e.SBM_Link IS NOT NULL"];
  if (hasRange) {
    signalFilters.push(`SUBSTR(CAST(e.SBM_Date AS STRING), 1, 10) BETWEEN '${dateStart}' AND '${dateEnd}'`);
  }
  const signalsSql = `
SELECT DISTINCT
  sc.topic_district AS District,
  SUBSTR(CAST(e.SBM_Date AS STRING), 1, 10) AS Date,
  e.curate_topic AS Keyword,
  e.SBM_Context AS Context,
  e.SBM_Link AS Link
FROM ${TABLE} AS sc
CROSS JOIN UNNEST(sc.engagement) AS e
WHERE ${signalFilters.join("\n  AND ")}
ORDER BY District, Date DESC, Link`;

  const [districts, personas, topics, signals] = await Promise.all([
    runPaged(districtsSql),
    runPaged(personasSql),
    runPaged(topicsSql),
    runPaged(signalsSql),
  ]);
  return { districts, personas, topics, signals };
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const memCache = new Map<string, { data: Payload; ts: number }>();
const inflight = new Map<string, Promise<Payload>>();

function getPayload(campaignNums: number[], dateStart: string, dateEnd: string): Promise<Payload> {
  const key = `${[...campaignNums].sort().join(",")}|${dateStart}|${dateEnd}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return Promise.resolve(cached.data);
  if (!inflight.has(key)) {
    const p = fetchPayload(campaignNums, dateStart, dateEnd)
      .then((data) => { memCache.set(key, { data, ts: Date.now() }); inflight.delete(key); return data; })
      .catch((err) => { inflight.delete(key); throw err; });
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaignNums = parseList(searchParams.get("campaign"))
    .map(toCampaignNum)
    .filter((n): n is number => n !== null);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd = searchParams.get("dateEnd") ?? "";

  try {
    return cachedJson(await getPayload(campaignNums, dateStart, dateEnd));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load data" }, { status: 500 });
  }
}
