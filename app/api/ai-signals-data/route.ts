import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// BigQuery via Metabase native driver (DB 34), reading the Right at School raw
// signals sheet directly. This is the ECDI source-of-truth sheet and carries
// Articles, Bids/RFPs, AND school board minutes (source='Minutes'). The older
// implementation queried the shared `ai_signals` analytics table (DB 67 / table
// 390) filtered to Client 11564, which never carried the Minutes-tagged rows —
// that's why the Account Intel tab was missing SBMs.
const DB_ID = 34;
const SIGNALS_TABLE = "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";

interface SignalCache { rows: Record<string, unknown>[]; columns: string[]; }
let memCache: SignalCache | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;
// Bump when the SQL template changes so warm-lambda caches drop stale rows.
const CACHE_VERSION = "ais-v2-raw-sheet";

// The AI Opportunity Feed page keys off these display names verbatim, so the
// aliases below MUST match (page.tsx:140-150 and the CSV columns at 280-281).
const SQL = `
SELECT
  organization    AS \`Organization\`,
  domain          AS \`Domain\`,
  state           AS \`State\`,
  campaign        AS \`Campaign #\`,
  keywords        AS \`Keywords\`,
  category        AS \`Category\`,
  date            AS \`Date\`,
  source          AS \`Source\`,
  source_link     AS \`Source Link\`,
  signal_analysis AS \`Signal Analysis\`,
  source_text     AS \`Source Text\`,
  SAFE_CAST(strength AS INT64) AS \`Strength\`,
  CAST(NULL AS STRING) AS \`Market\`
FROM ${SIGNALS_TABLE}
WHERE organization IS NOT NULL AND TRIM(organization) != ''
ORDER BY SAFE_CAST(strength AS INT64) DESC NULLS LAST, date DESC`;

// Fallback without source_text, for the case where some older RAS sheet
// version doesn't have that column — the tab still populates, just without
// the Source Text field.
const SQL_FALLBACK = SQL.replace(/\s*source_text\s+AS\s+`Source Text`,\n/, "\n");

async function runQuery(sql: string): Promise<SignalCache> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
      middleware: { "js-int-to-string?": true },
    }),
    cache: "no-store",
  });

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
  const rows: Record<string, unknown>[] = rawRows.map((row) =>
    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
  );
  return { rows, columns: cols };
}

async function fetchSignals(): Promise<SignalCache> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  let result: SignalCache;
  try {
    result = await runQuery(SQL);
  } catch {
    result = await runQuery(SQL_FALLBACK);
  }

  memCache = result;
  memCacheAt = Date.now();
  return memCache;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("nocache") === "1") {
      memCache = null;
      memCacheAt = 0;
    }
    const { rows, columns } = await fetchSignals();
    return cachedJson({ rows, columns, cacheVersion: CACHE_VERSION });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [], columns: [] }, { status: 500 });
  }
}
