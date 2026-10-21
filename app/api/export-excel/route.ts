import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const maxDuration = 300;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY      = process.env.METABASE_ADMIN_API_KEY!;
const DB_ID = 34;
const AI_DB_ID    = 67;
const AI_TABLE_ID = 390;
const AI_CLIENT_ID = 11564;
const EU_TABLE = "`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
const TI_TABLE = "`df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring`";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseList(v: string | null): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

// ── Section definitions (title + header fill colour matching ASSA ABLOY) ─────

interface SectionSpec {
  title: string;
  fill: string;     // ARGB pastel for header row
  tabColor: string; // ARGB saturated for worksheet tab
}

const SECTIONS: SectionSpec[] = [
  { title: "Engaged Users by District", fill: "FFDA9694", tabColor: "FFC0504D" },
  { title: "Account Intelligence",      fill: "FFB1A0C7", tabColor: "FF8064A2" },
  { title: "Persona Insights",          fill: "FFC4D79B", tabColor: "FF9BBB59" },
  { title: "Topic Insights",            fill: "FF92CDDC", tabColor: "FF4BACC6" },
  { title: "Leads Insights",            fill: "FFFABF8F", tabColor: "FFF79646" },
  { title: "Geo Insights",              fill: "FFD1FAE5", tabColor: "FF10B981" },
];

// ── Metabase helpers ──────────────────────────────────────────────────────────

async function queryCard(cardId: number, parameters: object[] = []): Promise<{ cols: string[]; rows: unknown[][] }> {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });
  if (!res.ok) return { cols: [], rows: [] };
  const data = await res.json();
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rows: unknown[][] = data.data?.rows ?? [];
  return { cols, rows };
}

async function queryCardJson(cardId: number, parameters: object[] = []): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${METABASE_URL}/api/card/${cardId}/query/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as Record<string, unknown>[];
}

async function loadAISignals(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: AI_DB_ID,
      type: "query",
      query: {
        "source-table": AI_TABLE_ID,
        filter: ["=", ["field", "Client ID", { "base-type": "type/Integer" }], AI_CLIENT_ID],
      },
      constraints: { "max-results": 1000000 },
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rawRows: unknown[][] = data.data?.rows ?? [];
  return rawRows.map((row) => Object.fromEntries(cols.map((col, i) => [col, (row as unknown[])[i]])));
}

async function queryNative(sql: string): Promise<{ cols: string[]; rows: unknown[][] }> {
  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "native",
      native: { query: sql },
      constraints: { "max-results": 1000000 },
      middleware: { "js-int-to-string?": true },
    }),
    cache: "no-store",
  });
  if (!res.ok) return { cols: [], rows: [] };
  const data = await res.json();
  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  return { cols, rows: data.data?.rows ?? [] };
}

// ── Parameter builders ────────────────────────────────────────────────────────

function campaignCode(c: unknown): string {
  return String(c ?? "").split(":")[0].trim();
}

function campaignParam(codes: string[]) {
  if (!codes.length) return [];
  return [{ id: "campaign", type: "string/=", value: codes, target: ["variable", ["template-tag", "Abmi_Campaign"]] }];
}

function campaignAndDate(codes: string[], dateStart: string, dateEnd: string) {
  const p: object[] = campaignParam(codes);
  if (dateStart && dateEnd) p.push({
    id: "date", type: "date/range",
    value: `${dateStart}~${dateEnd}`,
    target: ["dimension", ["template-tag", "Date"]],
  });
  return p;
}

// ── Dataset loaders ───────────────────────────────────────────────────────────

async function loadEngagedUsers(campaigns: string[]): Promise<{ cols: string[]; rows: unknown[][] }> {
  const where: string[] = ["topic_district IS NOT NULL", "topic_district != ''"];
  if (campaigns.length) where.push(`Abmi_Campaign IN (${campaigns.map(sqlStr).join(", ")})`);

  const sql = `
SELECT
  topic_district AS District,
  ANY_VALUE(email_domain) AS Domain,
  ANY_VALUE(state) AS State,
  ANY_VALUE(CONCAT('C', CAST(abm_campaign_num AS STRING))) AS Campaign,
  IF(MAX(CASE WHEN SBM_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS Intel,
  IF(MAX(CASE WHEN topic_Y_N = 'Y' THEN 1 ELSE 0 END) = 1, 'Y', 'N') AS Topic,
  SUM(IFNULL(SAFE_CAST(engagements AS FLOAT64), 0)) AS Engagements,
  COUNT(CASE WHEN SAFE_CAST(engagements AS FLOAT64) > 0 THEN 1 ELSE NULL END) AS \`Engaged Users\`,
  COUNT(NULLIF(CAST(leads AS STRING), '')) AS Leads,
  SUM(IFNULL(SAFE_CAST(downloads AS FLOAT64), 0)) AS \`Total Downloads\`,
  SUM(IFNULL(SAFE_CAST(cumulative_score AS FLOAT64), 0)) AS \`Intent Score\`,
  SUM(IFNULL(SAFE_CAST(cumulative_score_trend AS FLOAT64), 0)) AS \`Intent Score Trend\`
FROM ${EU_TABLE}
WHERE ${where.join(" AND ")}
GROUP BY topic_district
ORDER BY \`Intent Score\` DESC`;

  return queryNative(sql);
}

async function loadPersona(campaigns: string[], dateStart: string, dateEnd: string): Promise<{ cols: string[]; rows: unknown[][] }> {
  const where: string[] = [
    "topic_district IS NOT NULL", "topic_district != ''",
    "state IS NOT NULL", "state != ''", "state != 'cState'",
  ];
  if (campaigns.length) where.push(`Abmi_Campaign IN (${campaigns.map(sqlStr).join(", ")})`);
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(date_max_for_intent_scoring) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);
  }

  const sql = `
SELECT
  topic_district AS District,
  email_domain AS Domain,
  state AS State,
  job_title AS \`Job Function\`,
  CONCAT('C', CAST(abm_campaign_num AS STRING)) AS Campaign,
  SAFE_CAST(engagements AS FLOAT64) AS Engagements,
  CASE WHEN leads IS NOT NULL AND CAST(leads AS STRING) != '' THEN 1 ELSE 0 END AS Leads
FROM \`prj-datia-prod-e530.df_gcp_campaign_cbl_prod.prod_cbl_rightatschool_2025_scoring\`
WHERE ${where.join(" AND ")}
ORDER BY Engagements DESC`;

  return queryNative(sql);
}

async function loadGeoInsights(campaigns: string[], dateStart: string, dateEnd: string): Promise<{ cols: string[]; rows: unknown[][] }> {
  const where: string[] = [
    "SAFE_CAST(engagements AS FLOAT64) != 0",
    "state IS NOT NULL", "state != 'cState'", "state != ''",
  ];
  if (campaigns.length) where.push(`Abmi_Campaign IN (${campaigns.map(sqlStr).join(", ")})`);
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(date_max_for_intent_scoring) BETWEEN ${sqlStr(dateStart)} AND ${sqlStr(dateEnd)}`);
  }
  const sql = `
SELECT
  State,
  SUM(SAFE_CAST(engagements AS FLOAT64))  AS Engagements,
  COUNT(DISTINCT engaged_user)             AS \`Engaged Users\`,
  COUNT(DISTINCT leads)                    AS Leads
FROM ${EU_TABLE}
WHERE ${where.join("\n  AND ")}
GROUP BY State
ORDER BY Engagements DESC`;
  return queryNative(sql);
}

async function loadTopicInsights(campaigns: string[], dateStart: string, dateEnd: string): Promise<{ cols: string[]; rows: unknown[][] }> {
  const campaignNums = campaigns
    .map((c) => parseInt(c.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));

  const where: string[] = [
    "item.bombora_score IS NOT NULL",
    "item.topics IS NOT NULL",
    "LOWER(TRIM(item.topics)) != 'null'",
    "TRIM(item.topics) != ''",
    "item.SBM_state IS NOT NULL",
    "TRIM(item.SBM_state) != ''",
  ];
  if (campaignNums.length) where.push(`sc.abm_campaign_num IN (${campaignNums.join(",")})`);
  if (dateStart && dateEnd && DATE_REGEX.test(dateStart) && DATE_REGEX.test(dateEnd)) {
    where.push(`DATE(sc.last_updated) BETWEEN '${dateStart}' AND '${dateEnd}'`);
  }

  const sql = `
SELECT
  item.SBM_district AS District,
  sc.email_domain AS Domain,
  CONCAT('C', CAST(sc.abm_campaign_num AS STRING)) AS Campaign,
  item.SBM_state AS State,
  MAX(sc.date_max_for_intent_scoring) AS Date,
  item.topics AS Topic,
  MAX(item.bombora_score) AS \`Topic Score\`
FROM ${TI_TABLE} AS sc
CROSS JOIN UNNEST(sc.engagement) AS item
WHERE ${where.join(" AND ")}
GROUP BY item.SBM_district, sc.email_domain, sc.abm_campaign_num, item.SBM_state, item.topics
ORDER BY \`Topic Score\` DESC`;

  return queryNative(sql);
}

// ── Campaign filter safety net (client-side) ──────────────────────────────────

const CAMPAIGN_KEYS = new Set(["campaign", "camp", "camp.", "abmi_campaign", "abm_campaign"]);

function filterByCampaign(
  data: { cols: string[]; rows: unknown[][] },
  campaignCodes: string[],
): { cols: string[]; rows: unknown[][] } {
  if (!campaignCodes.length) return data;
  const campIdx = data.cols.findIndex((c) => CAMPAIGN_KEYS.has(c.toLowerCase()));
  if (campIdx < 0) return data;
  const codes = new Set(campaignCodes.map((c) => c.toUpperCase()));
  return {
    cols: data.cols,
    rows: data.rows.filter((r) => {
      const v = String(r[campIdx] ?? "").toUpperCase();
      return [...codes].some((c) => v.includes(c));
    }),
  };
}

function filterObjByCampaign(rows: Record<string, unknown>[], campaignCodes: string[]): Record<string, unknown>[] {
  if (!campaignCodes.length) return rows;
  const codes = new Set(campaignCodes.map((c) => c.toUpperCase()));
  return rows.filter((r) => {
    const v = String(r["Campaign"] ?? r["Campaign #"] ?? "").toUpperCase();
    return [...codes].some((c) => v.includes(c));
  });
}

// ── Master roll-up (one row per District, columns from all sections) ──────────

type AggKind = "sum" | "max" | "or" | "join" | "maxDate";

interface FieldConfig {
  sourceIdx: number | string; // array index (number) or object key (string)
  outHeader: string;
  agg: AggKind;
  kind?: "number" | "date";
  fill: string; // ARGB tint from the source section
}

interface MasterRecord {
  district: string;
  domain: string;
  state: string;
  campaign: string;
  values: Map<string, unknown>;
}

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function mergeField(rec: MasterRecord, field: FieldConfig, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return;
  switch (field.agg) {
    case "sum": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return;
      rec.values.set(field.outHeader, ((rec.values.get(field.outHeader) as number) ?? 0) + n);
      break;
    }
    case "max": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return;
      const prev = rec.values.get(field.outHeader) as number | undefined;
      if (prev === undefined || n > prev) rec.values.set(field.outHeader, n);
      break;
    }
    case "or": {
      const s = String(raw).trim().toUpperCase();
      if ((rec.values.get(field.outHeader) as string) !== "Y")
        rec.values.set(field.outHeader, s === "Y" ? "Y" : (rec.values.get(field.outHeader) as string ?? s));
      break;
    }
    case "join": {
      let set = rec.values.get(field.outHeader) as Set<string> | undefined;
      if (!set) { set = new Set(); rec.values.set(field.outHeader, set); }
      set.add(String(raw).trim());
      break;
    }
    case "maxDate": {
      const s = String(raw);
      const prev = rec.values.get(field.outHeader) as string | undefined;
      if (!prev || s > prev) rec.values.set(field.outHeader, s);
      break;
    }
  }
}

interface MasterColumn { header: string; kind?: "number" | "date" | "url"; fill?: string }

function buildMaster(
  eu: { cols: string[]; rows: unknown[][] },
  ai: Record<string, unknown>[],
  persona: { cols: string[]; rows: unknown[][] },
  topic: { cols: string[]; rows: unknown[][] },
  leads: { cols: string[]; rows: unknown[][] },
): { columns: MasterColumn[]; rows: unknown[][] } {
  const [EU_FILL, AI_FILL, PE_FILL, TI_FILL, LD_FILL] = SECTIONS.map((s) => s.fill);

  // EU column indices (by display name)
  const euIdx = (name: string) => eu.cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const euDistI = euIdx("district"); const euDomI = euIdx("domain"); const euStI = euIdx("state"); const euCampI = euIdx("campaign");

  const EU_FIELDS: FieldConfig[] = [
    { sourceIdx: euIdx("Intel"),             outHeader: "Intel",              agg: "or",  fill: EU_FILL },
    { sourceIdx: euIdx("Topic"),             outHeader: "Topic",              agg: "or",  fill: EU_FILL },
    { sourceIdx: euIdx("Engagements"),       outHeader: "Engagements",        agg: "sum", kind: "number", fill: EU_FILL },
    { sourceIdx: euIdx("Engaged Users"),     outHeader: "Engaged Users",      agg: "sum", kind: "number", fill: EU_FILL },
    { sourceIdx: euIdx("Leads"),             outHeader: "Leads",              agg: "sum", kind: "number", fill: EU_FILL },
    { sourceIdx: euIdx("Total Downloads"),   outHeader: "Total Downloads",    agg: "sum", kind: "number", fill: EU_FILL },
    { sourceIdx: euIdx("Intent Score"),      outHeader: "Intent Score",       agg: "sum", kind: "number", fill: EU_FILL },
    { sourceIdx: euIdx("Intent Score Trend"),outHeader: "Intent Score Trend", agg: "sum", kind: "number", fill: EU_FILL },
  ];

  const AI_FIELDS: FieldConfig[] = [
    { sourceIdx: "Keywords",        outHeader: "Keywords",          agg: "join",    fill: AI_FILL },
    { sourceIdx: "Category",        outHeader: "Category",          agg: "join",    fill: AI_FILL },
    { sourceIdx: "Date",            outHeader: "Date (AI)",         agg: "maxDate", kind: "date", fill: AI_FILL },
    { sourceIdx: "Source",          outHeader: "Source",            agg: "join",    fill: AI_FILL },
    { sourceIdx: "Source Link",     outHeader: "Link",              agg: "join",    fill: AI_FILL },
    { sourceIdx: "Strength",        outHeader: "Strength",          agg: "max",     kind: "number", fill: AI_FILL },
    { sourceIdx: "Signal Analysis", outHeader: "Signal Analysis",   agg: "join",    fill: AI_FILL },
    { sourceIdx: "Source Text",     outHeader: "Source Text",       agg: "join",    fill: AI_FILL },
    { sourceIdx: "Market",          outHeader: "Market",            agg: "join",    fill: AI_FILL },
  ];

  const peIdx = (name: string) => persona.cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const peDistI = peIdx("district"); const peDomI = peIdx("domain"); const peStI = peIdx("state"); const peCampI = peIdx("campaign");
  const PE_FIELDS: FieldConfig[] = [
    { sourceIdx: peIdx("Job Function"), outHeader: "Job Functions (Persona)", agg: "join",    fill: PE_FILL },
    { sourceIdx: peIdx("Engagements"),  outHeader: "Engagements (Persona)",   agg: "sum", kind: "number", fill: PE_FILL },
    { sourceIdx: peIdx("Leads"),        outHeader: "Leads (Persona)",         agg: "sum", kind: "number", fill: PE_FILL },
  ];

  const tiIdx = (name: string) => topic.cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const tiDistI = tiIdx("district"); const tiDomI = tiIdx("domain"); const tiStI = tiIdx("state"); const tiCampI = tiIdx("campaign");
  const TI_FIELDS: FieldConfig[] = [
    { sourceIdx: tiIdx("Date"),        outHeader: "Date (Topic Insights)",   agg: "maxDate", kind: "date", fill: TI_FILL },
    { sourceIdx: tiIdx("Topic"),       outHeader: "Topics",                  agg: "join",    fill: TI_FILL },
    { sourceIdx: tiIdx("Topic Score"), outHeader: "Topic Score",             agg: "sum", kind: "number", fill: TI_FILL },
  ];

  const ldIdx = (name: string) => leads.cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const ldDistI = ldIdx("district"); const ldDomI = ldIdx("domain"); const ldStI = ldIdx("state"); const ldCampI = ldIdx("campaign");
  const LD_FIELDS: FieldConfig[] = [
    { sourceIdx: ldIdx("Job Function"),    outHeader: "Job Functions (Leads)",  agg: "join",    fill: LD_FILL },
    { sourceIdx: ldIdx("Total Downloads"), outHeader: "Total Downloads (Leads)", agg: "sum", kind: "number", fill: LD_FILL },
  ];

  const records = new Map<string, MasterRecord>();

  function key(dist: string, dom: string) {
    return `${norm(dist)}||${norm(dom)}`;
  }

  function getOrCreate(dist: string, dom: string, state: string, campaign: string): MasterRecord {
    const k = key(dist, dom);
    if (!records.has(k)) records.set(k, { district: dist.trim(), domain: dom.trim(), state: state.trim(), campaign: campaign.trim(), values: new Map() });
    const r = records.get(k)!;
    if (!r.state && state) r.state = state.trim();
    if (!r.campaign && campaign) r.campaign = campaign.trim();
    return r;
  }

  // EU rows
  for (const row of eu.rows) {
    if (euDistI < 0) continue;
    const rec = getOrCreate(String(row[euDistI] ?? ""), String(row[euDomI] ?? ""), String(row[euStI] ?? ""), String(row[euCampI] ?? ""));
    for (const f of EU_FIELDS) mergeField(rec, f, row[f.sourceIdx as number]);
  }

  // AI signal rows (objects)
  for (const row of ai) {
    const dist = String(row["Organization"] ?? "").trim();
    const dom  = String(row["Domain"] ?? "").trim();
    if (!dist && !dom) continue;
    const rec = getOrCreate(dist, dom, String(row["State"] ?? ""), String(row["Campaign"] ?? ""));
    for (const f of AI_FIELDS) mergeField(rec, f, row[f.sourceIdx as string]);
  }

  // Persona rows
  for (const row of persona.rows) {
    if (peDistI < 0) continue;
    const rec = getOrCreate(String(row[peDistI] ?? ""), String(row[peDomI] ?? ""), String(row[peStI] ?? ""), String(row[peCampI] ?? ""));
    for (const f of PE_FIELDS) mergeField(rec, f, row[f.sourceIdx as number]);
  }

  // Topic rows
  for (const row of topic.rows) {
    if (tiDistI < 0) continue;
    const rec = getOrCreate(String(row[tiDistI] ?? ""), String(row[tiDomI] ?? ""), String(row[tiStI] ?? ""), String(row[tiCampI] ?? ""));
    for (const f of TI_FIELDS) mergeField(rec, f, row[f.sourceIdx as number]);
  }

  // Leads rows
  for (const row of leads.rows) {
    if (ldDistI < 0) continue;
    const rec = getOrCreate(String(row[ldDistI] ?? ""), String(row[ldDomI] ?? ""), String(row[ldStI] ?? ""), String(row[ldCampI] ?? ""));
    for (const f of LD_FIELDS) mergeField(rec, f, row[f.sourceIdx as number]);
  }

  const allFields = [...EU_FIELDS, ...AI_FIELDS, ...PE_FIELDS, ...TI_FIELDS, ...LD_FIELDS];

  // Date fields in Master are stored as pre-formatted text (MM-DD-YY) so the
  // format is display-safe regardless of Excel numFmt inheritance behaviour.
  function fmtMasterDate(v: unknown): string | null {
    const s = String(v ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}-${m[3]}-${m[1].slice(2)}` : s || null;
  }

  const columns: MasterColumn[] = [
    { header: "District" }, { header: "Domain" }, { header: "State" }, { header: "Campaign" },
    // Date fields stored as text strings — strip kind so writeSheet doesn't re-parse them
    ...allFields.map((f) => ({ header: f.outHeader, kind: f.kind === "date" ? undefined : f.kind, fill: f.fill })),
  ];

  const rows: unknown[][] = [...records.values()]
    .sort((a, b) => a.district.localeCompare(b.district))
    .map((rec) => {
      const base: unknown[] = [rec.district, rec.domain, rec.state, rec.campaign];
      const rest = allFields.map((f) => {
        const v = rec.values.get(f.outHeader);
        if (v instanceof Set) return [...v].filter(Boolean).sort().join("; ") || null;
        if (f.kind === "date") return fmtMasterDate(v);
        return v ?? null;
      });
      return [...base, ...rest];
    });

  return { columns, rows };
}

// ── ExcelJS sheet writer ──────────────────────────────────────────────────────

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function cleanStr(v: unknown): string {
  return String(v ?? "").replace(INVALID_XML, "").slice(0, 32767);
}

function toCell(v: unknown, kind?: "number" | "date" | "url"): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (kind === "number") {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : cleanStr(v);
  }
  if (kind === "date") {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : cleanStr(v);
  }
  if (kind === "url") {
    const url = String(v).trim();
    return /^https?:\/\//i.test(url) ? { text: cleanStr(url), hyperlink: url } : cleanStr(url);
  }
  return typeof v === "number" ? v : cleanStr(v);
}

const LONG_HEADERS = new Set([
  "District", "Organization", "Domain", "Keywords", "Category", "Signal Analysis",
  "Source Text", "Job Function", "Job Functions (Persona)", "Job Functions (Leads)",
  "Topics", "Topic", "Job Function (Persona)", "Job Function (Leads Insights)", "Topic (Topic Insights)",
]);

function writeSheet(
  wb: ExcelJS.Workbook,
  title: string,
  fill: string,
  columns: { header: string; kind?: "number" | "date" | "url"; fill?: string }[],
  rows: unknown[][],
  tabColor?: string,
) {
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  if (tabColor) ws.properties.tabColor = { argb: tabColor };

  const headerRow = ws.getRow(1);
  columns.forEach((col, j) => {
    const cell = headerRow.getCell(j + 1);
    cell.value = col.header;
    const argb = col.fill ?? fill;
    if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 20;

  for (const row of rows) {
    ws.addRow(row.map((v, j) => toCell(v, columns[j]?.kind)));
  }

  columns.forEach((col, j) => {
    const c = ws.getColumn(j + 1);
    if (col.kind === "number") c.numFmt = "#,##0";
    if (col.kind === "date")   c.numFmt = "yyyy-mm-dd";
    if (col.kind === "url")    c.font = { color: { argb: "FF1D4ED8" }, underline: true };
    c.width = LONG_HEADERS.has(col.header) ? 40 : col.kind === "url" ? 36 : Math.max(12, col.header.length + 4);
  });
}

// ── Master sheet column formatting ───────────────────────────────────────────

const MASTER_COLS: { w: number; h: "left" | "center"; numFmt?: string }[] = [
  { w: 50, h: "left"   },                        // A  District
  { w: 30, h: "left"   },                        // B  Domain
  { w: 10, h: "center" },                        // C  State
  { w: 10, h: "center" },                        // D  Campaign
  { w: 10, h: "center" },                        // E
  { w: 10, h: "center" },                        // F
  { w: 10, h: "center" },                        // G
  { w: 10, h: "center" },                        // H
  { w: 10, h: "center" },                        // I
  { w: 10, h: "center" },                        // J
  { w: 10, h: "center" },                        // K
  { w: 10, h: "center" },                        // L
  { w: 25, h: "left"   },                        // M
  { w: 25, h: "left"   },                        // N
  { w: 15, h: "left",   numFmt: "mm-dd-yy" },    // O  date
  { w: 20, h: "left"   },                        // P
  { w: 20, h: "left"   },                        // Q
  { w:  8, h: "center" },                        // R
  { w: 40, h: "left"   },                        // S
  { w: 40, h: "left"   },                        // T
  { w: 10, h: "left"   },                        // U
  { w: 40, h: "left"   },                        // V
  { w: 10, h: "center" },                        // W
  { w: 10, h: "center" },                        // X
  { w: 15, h: "left",   numFmt: "mm-dd-yy" },    // Y  date
  { w: 40, h: "left"   },                        // Z
  { w: 10, h: "center" },                        // AA
  { w: 40, h: "left"   },                        // AB
  { w: 16, h: "center" },                        // AC
];

function formatMasterSheet(ws: ExcelJS.Worksheet) {
  ws.getRow(1).height = 30;

  MASTER_COLS.forEach((fmt, i) => {
    const col = ws.getColumn(i + 1);
    col.width = fmt.w;
    col.eachCell((cell) => {
      cell.alignment = { horizontal: fmt.h, vertical: "top", wrapText: true };
      if (fmt.numFmt) cell.numFmt = fmt.numFmt;
    });
  });
}

// ── AI signals column normalisation ──────────────────────────────────────────

const AI_ORDERED_KEYS = [
  "Organization", "Domain", "State", "Campaign", "Keywords",
  "Category", "Date", "Source", "Source Link", "Strength", "Signal Analysis", "Source Text", "Market",
];

function aiToRows(rows: Record<string, unknown>[]): { cols: string[]; rows: unknown[][] } {
  const cols = AI_ORDERED_KEYS.map((k) => (k === "Source Link" ? "Link" : k));
  const out = rows.map((r) => AI_ORDERED_KEYS.map((k) => r[k] ?? null));
  return { cols, rows: out };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sp        = req.nextUrl.searchParams;
    const campaigns = parseList(sp.get("campaign"));
    const dateStart = sp.get("dateStart") ?? "";
    const dateEnd   = sp.get("dateEnd")   ?? "";

    const campaignCodes = campaigns.map((c) => c.split(":")[0].trim());
    const leadsParams  = campaignAndDate(campaignCodes, dateStart, dateEnd);

    const [euRaw, aiRaw, personaRaw, topicRaw, leadsRaw, geoRaw] = await Promise.all([
      loadEngagedUsers(campaigns),
      loadAISignals(),
      loadPersona(campaigns, dateStart, dateEnd),
      loadTopicInsights(campaignCodes, dateStart, dateEnd),
      queryCard(174, leadsParams),
      loadGeoInsights(campaigns, dateStart, dateEnd),
    ]);

    const eu      = euRaw;
    const ai      = filterObjByCampaign(aiRaw, campaignCodes);
    const persona = personaRaw;
    const topic   = topicRaw;
    const leads   = filterByCampaign(leadsRaw, campaignCodes);
    const geo     = geoRaw;

    // AI as flat array rows for the individual sheet
    const aiFlat = aiToRows(ai);

    // Build Master roll-up
    const master = buildMaster(eu, ai, persona, topic, leads);

    // Build workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "DATIA ABMxi";
    wb.created = new Date();

    // Master sheet (identifier columns use light gray, field columns use source-section tint)
    writeSheet(wb, "Master", "FFE5E7EB", master.columns, master.rows);
    formatMasterSheet(wb.getWorksheet("Master")!);

    // Individual sheets
    writeSheet(wb, SECTIONS[0].title, SECTIONS[0].fill,
      eu.cols.map((h) => ({ header: h, kind: ["Engagements","Engaged Users","Leads","Total Downloads","Intent Score","Intent Score Trend"].includes(h) ? "number" as const : undefined })),
      eu.rows, SECTIONS[0].tabColor,
    );
    writeSheet(wb, SECTIONS[1].title, SECTIONS[1].fill,
      aiFlat.cols.map((h) => ({ header: h, kind: h === "Date" ? "date" as const : h === "Strength" ? "number" as const : h === "Link" ? "url" as const : undefined })),
      aiFlat.rows, SECTIONS[1].tabColor,
    );
    writeSheet(wb, SECTIONS[2].title, SECTIONS[2].fill,
      persona.cols.map((h) => ({ header: h, kind: ["Engagements","Leads"].includes(h) ? "number" as const : undefined })),
      persona.rows, SECTIONS[2].tabColor,
    );
    writeSheet(wb, SECTIONS[3].title, SECTIONS[3].fill,
      topic.cols.map((h) => ({ header: h, kind: h === "Topic Score" ? "number" as const : h === "Date" ? "date" as const : undefined })),
      topic.rows, SECTIONS[3].tabColor,
    );
    writeSheet(wb, SECTIONS[4].title, SECTIONS[4].fill,
      leads.cols.map((h) => ({ header: h, kind: ["Total Downloads","Downloads"].includes(h) ? "number" as const : undefined })),
      leads.rows, SECTIONS[4].tabColor,
    );
    writeSheet(wb, SECTIONS[5].title, SECTIONS[5].fill,
      geo.cols.map((h) => ({ header: h, kind: ["Engagements","Engaged Users","Leads"].includes(h) ? "number" as const : undefined })),
      geo.rows, SECTIONS[5].tabColor,
    );

    const buf = await wb.xlsx.writeBuffer();

    const stamp = new Date().toISOString().slice(0, 10);
    const codes = campaignCodes.filter(Boolean);
    const label = codes.length === 0 ? "All-Campaigns" : codes.length <= 3 ? codes.join("-") : `${codes.length}-Campaigns`;
    const filename = `ABMxi_Export_All_${label}_${stamp}.xlsx`;

    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
