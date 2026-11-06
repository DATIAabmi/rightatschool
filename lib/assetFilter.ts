// Build a BigQuery predicate that keeps only scoring-table rows whose
// engagement array contains at least one item for one of the selected
// asset_codes. The engagement items carry asset_name; ad_performance
// is the lookup from asset_code → asset_name, so we resolve the picked
// codes to names once and check membership on the engagement side.
//
// Previous implementation keyed only on abm_campaign, which meant every
// scoring row in a campaign survived as long as the campaign had ANY
// ad for the asset — the filter did nothing within one campaign.
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
    SELECT 1 FROM UNNEST(${prefix}engagement) AS _asset_e
    WHERE LOWER(CAST(_asset_e.asset_name AS STRING)) IN (
      SELECT DISTINCT LOWER(CAST(ap.asset_name AS STRING))
      FROM ${AD_PERF_TABLE} ap
      WHERE LOWER(CAST(ap.asset_code AS STRING)) IN (${vals})
    )
  )`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
