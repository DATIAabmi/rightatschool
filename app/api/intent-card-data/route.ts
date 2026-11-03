import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// Scoring/engagement table (BigQuery via Metabase native driver, DB 34).
const DB_ID = 34;
const TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";

// ai_signals lives in a different Metabase database (analytics, DB 67). We hit
// it via the structured query API because that's how it's wired in Metabase.
const AI_DB_ID = 67;
const AI_TABLE_ID = 390;
const AI_CLIENT_ID = 11564; // Right at School

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

// ai_signals fetch, cached in-process for 30 min so expanding many rows doesn't
// hammer Metabase. Same shape ai-opportunity-feed uses.
interface AiCache { rows: Record<string, unknown>[]; }
let aiCache: AiCache | null = null;
let aiCacheAt = 0;
const AI_CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchAiSignals(): Promise<Record<string, unknown>[]> {
  if (aiCache && Date.now() - aiCacheAt < AI_CACHE_TTL_MS) return aiCache.rows;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: AI_DB_ID,
      type: "query",
      query: {
        "source-table": AI_TABLE_ID,
        filter: ["=", ["field", "Client ID", { "base-type": "type/Integer" }], AI_CLIENT_ID],
      },
      constraints: { "max-results": 1000000 },
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rawRows: unknown[][] = data.data?.rows ?? [];
  const rows = rawRows.map((row) => Object.fromEntries(cols.map((col, i) => [col, (row as unknown[])[i]])));
  aiCache = { rows };
  aiCacheAt = Date.now();
  return rows;
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
      .filter(Boolean)
      .map((c) => c.toUpperCase());

    const districtKey = district.trim().toUpperCase();

    // Persona uses the SAME aggregation shape as the parent row (COUNT of
    // engaged rows and SUM of engagements), so summing the card reconciles
    // against the KPI strip at the top of the Intent Report. Rows with no
    // job_title still contribute under the "Unknown" bucket, so a district with
    // leads but null job titles doesn't come back empty.
    const sqlPersona = `
SELECT
  COALESCE(NULLIF(job_title, ''), 'Unknown') AS JobFunction,
  COUNT(CASE WHEN SAFE_CAST(engagements AS FLOAT64) > 0 THEN 1 END) AS Users,
  SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(NULLIF(CAST(leads AS STRING), '')) AS Leads
FROM ${TABLE}
WHERE topic_district = ${districtVal}
GROUP BY JobFunction
HAVING Users > 0 OR Engagements > 0 OR Leads > 0
ORDER BY Engagements DESC, Leads DESC`;

    // Bombora topics live inside UNNEST(engagement). Composite score is 0–100.
    const sqlTopics = `
SELECT
  item.topics AS Topic,
  MAX(SAFE_CAST(item.bombora_score AS INT64)) AS Score,
  FORMAT_DATE('%Y-%m-%d', MAX(DATE(sc.date_max_for_intent_scoring))) AS Date
FROM ${TABLE} AS sc, UNNEST(sc.engagement) AS item
WHERE sc.topic_district = ${districtVal}
  AND item.bombora_score IS NOT NULL
  AND item.topics IS NOT NULL
  AND LOWER(TRIM(item.topics)) != 'null'
  AND TRIM(item.topics) != ''
GROUP BY item.topics
ORDER BY Score DESC
LIMIT 15`;

    // The district's email_domains, used to match ai_signals rows whose
    // Organization name doesn't line up but whose Domain does.
    const sqlDomains = `
SELECT DISTINCT email_domain AS d
FROM ${TABLE}
WHERE topic_district = ${districtVal}
  AND email_domain IS NOT NULL AND email_domain != ''`;

    const [personaResult, topicsResult, domainsResult, aiRows] = await Promise.all([
      runQuery(sqlPersona),
      runQuery(sqlTopics).catch(() => ({ cols: [], rows: [] })),
      runQuery(sqlDomains).catch(() => ({ cols: [], rows: [] })),
      fetchAiSignals().catch(() => [] as Record<string, unknown>[]),
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

    const districtDomains = new Set<string>(
      domainsResult.rows
        .map((r) => String((r as unknown[])[0] ?? "").trim().toLowerCase())
        .filter(Boolean),
    );

    // Filter ai_signals by Organization match OR Domain match, plus optional
    // campaign filter — matches the ai-opportunity-feed convention.
    const signals: SignalRow[] = aiRows
      .filter((r) => {
        const org = String(r["Organization"] ?? "").trim().toUpperCase();
        const dom = String(r["Domain"] ?? "").trim().toLowerCase();
        const orgMatch = !!org && org === districtKey;
        const domMatch = !!dom && districtDomains.has(dom);
        if (!orgMatch && !domMatch) return false;
        if (campaignCodes.length) {
          const camp = String(r["Campaign #"] ?? "").trim().toUpperCase();
          if (!campaignCodes.includes(camp)) return false;
        }
        return true;
      })
      .map((r) => ({
        Date:       String(r["Date"] ?? ""),
        Category:   String(r["Category"] ?? ""),
        Keywords:   String(r["Keywords"] ?? ""),
        Source:     String(r["Source"] ?? ""),
        Link:       String(r["Source Link"] ?? ""),
        Analysis:   String(r["Signal Analysis"] ?? ""),
        SourceText: String(r["Source Text"] ?? ""),
        Strength:   Number(r["Strength"] ?? 0),
      }))
      .sort((a, b) => {
        if (b.Strength !== a.Strength) return b.Strength - a.Strength;
        return b.Date.localeCompare(a.Date);
      })
      .slice(0, 25);

    return NextResponse.json({ persona, signals, topics });
  } catch (err) {
    return NextResponse.json({ persona: [], signals: [], topics: [], error: String(err) });
  }
}
