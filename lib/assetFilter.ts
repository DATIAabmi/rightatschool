// Build a BigQuery predicate that keeps only scoring-table rows whose
// engagement[] array contains at least one entry whose asset_name
// matches one of the selected values. The scoring engagement[] struct
// has asset_name + asset_type but no separate short-code column — so
// the dropdown lists distinct asset_name titles and the filter
// compares on asset_name directly (case-insensitive, exact match).
//
// Returns just the predicate (no leading AND / WHERE), so callers can
// plug it into their existing WHERE-clause composition. Empty when no
// filter.
function sqlEscape(v: string): string {
  return `'${v.replace(/[‘’‛]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function assetFilterClause(assets: string[], tableAlias: string = ""): string {
  if (!assets.length) return "";
  const vals = assets.map((a) => sqlEscape(a.toLowerCase())).join(", ");
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `EXISTS (SELECT 1 FROM UNNEST(${prefix}engagement) e WHERE LOWER(CAST(e.asset_name AS STRING)) IN (${vals}))`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
