// Build a BigQuery predicate that keeps only scoring-table rows whose
// engagement[] array contains at least one entry whose asset_name
// matches an asset_name that the ad-performance table pairs with one
// of the selected asset_codes. The scoring engagement[] struct has
// asset_name + asset_type but no short-code column; asset_code lives
// on the ad-performance table as a parallel short identifier. A
// correlated subquery translates asset_code → asset_name at query time
// so the filter stays accurate even if the mapping changes.
//
// Returns just the predicate (no leading AND / WHERE), so callers can
// plug it into their existing WHERE-clause composition. Empty when no
// filter.
const AD_PERF_TABLE =
  "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_ad_performance`";

function sqlEscape(v: string): string {
  return `'${v.replace(/[‘’‛]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function assetFilterClause(assets: string[], tableAlias: string = ""): string {
  if (!assets.length) return "";
  const vals = assets.map((a) => sqlEscape(a.toLowerCase())).join(", ");
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `EXISTS (
    SELECT 1 FROM UNNEST(${prefix}engagement) e
    WHERE LOWER(CAST(e.asset_name AS STRING)) IN (
      SELECT LOWER(asset_name) FROM ${AD_PERF_TABLE}
      WHERE LOWER(asset_code) IN (${vals})
    )
  )`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
