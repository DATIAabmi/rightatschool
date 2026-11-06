// Scoring rows carry engagement items (an array column) whose asset_name
// is the per-user link to a creative. ad_performance holds the
// asset_code → asset_name mapping. BigQuery can't execute a correlated
// EXISTS over UNNEST(engagement) with an inline subquery against
// ad_performance (it refuses "correlated subqueries that reference
// other tables"), so we resolve codes → names in JS first, cache the
// mapping, and inline the names as a literal IN list.

const AD_PERF_TABLE =
  "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_ad_performance`";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

function sqlEscape(v: string): string {
  return `'${v.replace(/[‘’‛]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// asset_code (lowered) → Set of asset_name values that map to it
let codeToNamesCache: Map<string, string[]> | null = null;
let codeToNamesCachedAt = 0;
const CODE_CACHE_TTL_MS = 30 * 60 * 1000;

async function loadCodeToNames(): Promise<Map<string, string[]>> {
  if (codeToNamesCache && Date.now() - codeToNamesCachedAt < CODE_CACHE_TTL_MS) {
    return codeToNamesCache;
  }
  const sql = `
    SELECT DISTINCT
      LOWER(CAST(asset_code AS STRING)) AS code,
      CAST(asset_name AS STRING) AS name
    FROM ${AD_PERF_TABLE}
    WHERE asset_code IS NOT NULL AND asset_name IS NOT NULL`;
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`asset code lookup failed: ${res.status}`);
  const data = await res.json();
  const rows: [string, string][] = (data.data?.rows ?? []) as [string, string][];
  const map = new Map<string, string[]>();
  for (const [code, name] of rows) {
    if (!code || !name) continue;
    const bucket = map.get(code) ?? [];
    bucket.push(name);
    map.set(code, bucket);
  }
  codeToNamesCache = map;
  codeToNamesCachedAt = Date.now();
  return map;
}

export async function resolveAssetNames(assetCodes: string[]): Promise<string[]> {
  if (!assetCodes.length) return [];
  const map = await loadCodeToNames();
  const out = new Set<string>();
  for (const code of assetCodes) {
    for (const name of map.get(code.toLowerCase()) ?? []) out.add(name);
  }
  return [...out];
}

// Build a BigQuery predicate that keeps only scoring rows whose
// engagement array contains at least one item with one of the given
// asset names. Caller must resolve asset_codes → names via
// resolveAssetNames first (async, cached).
//
// Returns just the predicate (no leading AND / WHERE). Empty string
// when no filter. Returns `1=0` when codes were requested but none
// resolved — that way the filter still forces an empty result instead
// of silently showing everything.
export function assetFilterClause(assetNames: string[], tableAlias: string = ""): string {
  if (!assetNames.length) return "";
  const vals = assetNames.map((a) => sqlEscape(a.toLowerCase())).join(", ");
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `EXISTS (
    SELECT 1 FROM UNNEST(${prefix}engagement) AS _asset_e
    WHERE LOWER(CAST(_asset_e.asset_name AS STRING)) IN (${vals})
  )`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
