import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";
import { assetFilterClause, resolveAssetNames } from "@/lib/assetFilter";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;

const AD_TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_ad_performance`";
const SC_TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";

const CACHE_TTL_MS = 30 * 60 * 1000;
type FunnelResult = { impressions: unknown; engagements: unknown; ctr: unknown; engagedUsers: unknown; leads: unknown };
const memCache = new Map<string, { data: FunnelResult; ts: number }>();
const inflight = new Map<string, Promise<FunnelResult>>();

function sqlStr(v: string): string {
  return `'${v.replace(/[\u2018\u2019\u201B]/g, "'").replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

async function runSQL(sql: string): Promise<unknown[] | null> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ database: DB_ID, type: "native", native: { query: sql }, middleware: { "js-int-to-string?": true } }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const rows: unknown[][] = data.data?.rows ?? [];
  return rows[0] ?? null;
}

async function fetchFunnelForCampaign(campaign: string, dateStart: string, dateEnd: string, assets: string[]): Promise<FunnelResult> {
  const campaignClause = campaign ? `AND abmi_campaign = ${sqlStr(campaign)}` : "";
  const dateClause = dateStart && dateEnd
    ? `AND DATE(date) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`
    : "";

  const scoringCampaignClause = campaign ? `AND sc.Abmi_Campaign = ${sqlStr(campaign)}` : "";

  // ad_performance carries asset_code as a direct column — filter inline.
  // scoring joins via asset_name in engagement array (asset_code lives in
  // ad_performance only), so we resolve codes → names once and feed the
  // engagement-level predicate.
  const adAssetClause = assets.length
    ? `AND LOWER(asset_code) IN (${assets.map((a) => sqlStr(a.toLowerCase())).join(", ")})`
    : "";
  const assetNames = await resolveAssetNames(assets);
  const scAssetPredicate = assetFilterClause(assetNames, "sc");
  // Picked a code that resolves to no name → force empty engaged/leads.
  const forceEmpty = assets.length && !assetNames.length ? "AND 1=0" : "";
  const scAssetClause = scAssetPredicate ? `AND ${scAssetPredicate}` : forceEmpty;

  const [r_imp, r_eng, r_ctr, r_egu, r_leads] = await Promise.all([
    runSQL(`SELECT SUM(impressions) FROM ${AD_TABLE} WHERE 1=1 ${campaignClause} ${dateClause} ${adAssetClause}`),
    runSQL(`SELECT COALESCE(SUM(clicks), 0) FROM ${AD_TABLE} WHERE 1=1 ${campaignClause} ${dateClause} ${adAssetClause}`),
    runSQL(`SELECT CONCAT(ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2), '%') FROM ${AD_TABLE} WHERE 1=1 ${campaignClause} ${dateClause} ${adAssetClause}`),
    // Looker's "Unique users who viewed your content from all sources":
    // count users whose TOTAL engagement sum across the campaign is >= 1.
    // Each scoring row is a weekly slice; row-level engagements can be
    // fractional for bombora signal matches. Filtering at the per-row level
    // (engagements > 0) leaves signal-only users in; summing per user and
    // requiring >= 1 keeps only users whose engagements reach a real event.
    runSQL(`SELECT COUNT(*) FROM (
      SELECT sc.engaged_user
      FROM ${SC_TABLE} sc
      WHERE sc.engaged_user IS NOT NULL ${scoringCampaignClause} ${scAssetClause}
      GROUP BY sc.engaged_user
      HAVING SUM(IFNULL(SAFE_CAST(sc.engagements AS FLOAT64), 0)) >= 1
    )`),
    runSQL(`SELECT COUNT(DISTINCT sc.leads) FROM ${SC_TABLE} sc WHERE sc.leads IS NOT NULL AND sc.leads != '' ${scoringCampaignClause} ${scAssetClause}`),
  ]);

  return {
    impressions:  r_imp?.[0]   ?? null,
    engagements:  r_eng?.[0]   ?? null,
    ctr:          r_ctr?.[0]   ?? null,
    engagedUsers: r_egu?.[0]   ?? null,
    leads:        r_leads?.[0] ?? null,
  };
}

function sum(values: (string | number | null)[]): number | null {
  const nums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function avgPct(values: (string | number | null)[]): string | null {
  const nums = values
    .map((v) => (typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v)))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return `${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}%`;
}

async function getResult(campaigns: string[], dateStart: string, dateEnd: string, assets: string[]): Promise<FunnelResult> {
  const key = `${campaigns.join(",")}|${dateStart}|${dateEnd}|${assets.join(",")}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  if (!inflight.has(key)) {
    const p = (async () => {
      let result: FunnelResult;
      if (campaigns.length <= 1) {
        result = await fetchFunnelForCampaign(campaigns[0] ?? "", dateStart, dateEnd, assets);
      } else {
        const perCampaign = await Promise.all(campaigns.map((c) => fetchFunnelForCampaign(c, dateStart, dateEnd, assets)));
        result = {
          impressions:  sum(perCampaign.map((r) => r.impressions  as string | number | null)),
          engagements:  sum(perCampaign.map((r) => r.engagements  as string | number | null)),
          ctr:          avgPct(perCampaign.map((r) => r.ctr       as string | number | null)),
          engagedUsers: sum(perCampaign.map((r) => r.engagedUsers as string | number | null)),
          leads:        sum(perCampaign.map((r) => r.leads        as string | number | null)),
        };
      }
      memCache.set(key, { data: result, ts: Date.now() });
      inflight.delete(key);
      return result;
    })();
    p.catch(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const campaigns = (searchParams.get("campaign") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const assets    = (searchParams.get("asset")    ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dateStart = searchParams.get("dateStart") ?? "";
  const dateEnd   = searchParams.get("dateEnd")   ?? "";
  const result = await getResult(campaigns, dateStart, dateEnd, assets);
  const hasData = result.impressions !== null || result.engagements !== null;
  return hasData ? cachedJson(result) : NextResponse.json(result);
}
