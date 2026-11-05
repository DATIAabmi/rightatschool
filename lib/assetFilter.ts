// Build a BigQuery predicate that keeps only scoring-table rows whose
// asset_code matches one of the selected values. asset_code is a
// top-level column on the scoring table — one row per
// user × campaign × asset — holding the short code "asset01",
// "asset02", … (alongside asset_name "Empowering Communication …" and
// asset_type "Guide"). The dropdown passes asset_code strings verbatim.
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
  return `LOWER(CAST(${prefix}asset_code AS STRING)) IN (${vals})`;
}

// Standard `?asset=foo,bar` parser matching parseList in each route.
export function parseAssets(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
