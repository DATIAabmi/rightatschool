import { NextResponse } from "next/server";

export const maxDuration = 30;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

// Diagnostic route: dumps the real BigQuery column names (and one sample row)
// of the raw signals sheet, plus a count of how many rows match Greenfield
// by domain or org name. Call: /api/debug-signals-schema
//
// Delete this route once the Intel column shows the expected values.
export async function GET() {
  try {
    const schemaSql = `
SELECT column_name
FROM \`prj-datia-prod-e530.raw_google_sheet.INFORMATION_SCHEMA.COLUMNS\`
WHERE table_name = 'raw_ebcg_right_at_schools_2025'
ORDER BY ordinal_position`;

    const sampleSql = `
SELECT *
FROM \`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025\`
LIMIT 3`;

    const greenfieldSql = `
SELECT *
FROM \`prj-datia-prod-e530.raw_google_sheet.raw_ebcg_right_at_schools_2025\`
WHERE LOWER(organization) LIKE '%greenfield%'
   OR LOWER(domain) LIKE '%gfusd%'
LIMIT 5`;

    const run = async (sql: string) => {
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
    };

    const [schema, sample, greenfield] = await Promise.all([
      run(schemaSql),
      run(sampleSql),
      run(greenfieldSql).catch((e) => ({ error: String(e) })),
    ]);

    return NextResponse.json({ schema, sample, greenfield });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
