import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const SCORING = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
const SIGNALS = "`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025`";

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function run(sql: string) {
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
    return { error: `Metabase ${res.status}: ${body.slice(0, 500)}` };
  }
  const data = await res.json();
  if (data.error) return { error: String(data.error).slice(0, 500) };
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string; name?: string }) => c.name ?? c.display_name);
  return { cols, rows: data.data?.rows ?? [] };
}

// Dumps schema + samples + Greenfield matches, and when ?district=... is given
// evaluates exactly what the Intel CTE would see for that district.
// Delete this route once Intel is confirmed working.
export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get("district") ?? "";

    const schemaSql = `
SELECT column_name
FROM \`prj-datia-prod-e530.raw_google_sheet.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name = 'raw_ebcg_right_at_schools_2025'
ORDER BY ordinal_position`;

    const sampleSql = `
SELECT *
FROM ${SIGNALS}
LIMIT 3`;

    const greenfieldLikeSql = `
SELECT *
FROM ${SIGNALS}
WHERE LOWER(organization) LIKE '%greenfield%'
   OR LOWER(domain) LIKE '%gfusd%'
LIMIT 5`;

    const [schema, sample, greenfield] = await Promise.all([
      run(schemaSql),
      run(sampleSql),
      run(greenfieldLikeSql),
    ]);

    let districtDiag: unknown = null;
    if (district) {
      const dv = sqlStr(district);
      const NORM = (col: string) =>
        `UPPER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(${col}), r",\\s*[A-Z]{2}\\s*$", ""), r"['‘’\\x60]", ""))`;

      // 1. What does the scoring table know about this district?
      const scoringSql = `
SELECT
  topic_district,
  COUNT(*) AS rows,
  COUNT(DISTINCT email_domain) AS distinct_domains,
  ARRAY_AGG(DISTINCT email_domain IGNORE NULLS LIMIT 10) AS sample_domains
FROM ${SCORING}
WHERE topic_district = ${dv}
GROUP BY topic_district`;

      // 2. Does the signals sheet have any match by domain (what my CTE's second clause tries)?
      const byDomainSql = `
WITH doms AS (
  SELECT DISTINCT email_domain AS d FROM ${SCORING}
  WHERE topic_district = ${dv}
    AND email_domain IS NOT NULL AND email_domain != ''
)
SELECT COUNT(*) AS by_domain_matches
FROM ${SIGNALS} s
WHERE LOWER(TRIM(s.domain)) IN (SELECT LOWER(TRIM(d)) FROM doms)`;

      // 3. Does the signals sheet have any match by exact normalized org name?
      const byOrgSql = `
SELECT COUNT(*) AS by_exact_org_matches
FROM ${SIGNALS} s
WHERE ${NORM("s.organization")} = ${NORM(dv)}`;

      // 4. By containment?
      const byContainsSql = `
SELECT COUNT(*) AS by_contains_matches,
       ARRAY_AGG(DISTINCT s.organization IGNORE NULLS LIMIT 10) AS sample_orgs
FROM ${SIGNALS} s
WHERE STRPOS(${NORM("s.organization")}, ${NORM(dv)}) > 0
   OR STRPOS(${NORM(dv)}, ${NORM("s.organization")}) > 0`;

      const [scoring, byDomain, byExact, byContains] = await Promise.all([
        run(scoringSql),
        run(byDomainSql),
        run(byOrgSql),
        run(byContainsSql),
      ]);

      districtDiag = { district, scoring, byDomain, byExact, byContains };
    }

    return NextResponse.json({ schema, sample, greenfield, districtDiag });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
