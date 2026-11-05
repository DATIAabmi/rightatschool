// Build a BigQuery predicate that keeps only scoring-table rows whose
// abm_campaign has at least one matching ad-performance row with one of
// the selected asset_codes. Scoring + ad_performance relate on
// abm_campaign (scoring has no asset_code of its own); we do the
// equivalent of a LEFT JOIN as a correlated EXISTS so scoring rows
// don't fan out when a campaign has multiple ads.
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
    SELECT 1 FROM ${AD_PERF_TABLE} ap
    WHERE ap.abm_campaign = ${prefix}abm_campaign
      AND LOWER(CAST(ap.asset_code AS STRING)) IN (${vals})
  )`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
