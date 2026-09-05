import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;

// ai_signals table in "My First Project" database — has District, Domain, State, Campaign
const DB_ID    = 67;
const TABLE_ID = 390;

interface SignalCache { rows: Record<string, unknown>[]; columns: string[]; }
let memCache: SignalCache | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchSignals(): Promise<SignalCache> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  const res = await fetch(`${METABASE_URL}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      database: DB_ID,
      type: "query",
      query: { "source-table": TABLE_ID },
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const data = await res.json();

  const cols: string[] = (data.data?.cols ?? []).map((c: { display_name: string }) => c.display_name);
  const rawRows: unknown[][] = data.data?.rows ?? [];

  // Normalize Source Tags values to consolidated display labels
  const SOURCE_TAG_MAP: Record<string, string> = {
    "news":      "News & Media",
    "articles":  "News & Media",
    "posts":     "News & Media",
    "interview": "News & Media",
  };

  // Normalize Category Tags values to consolidated display labels
  const CATEGORY_TAG_MAP: Record<string, string> = {
    "rfp bids":            "RFPs/Grants/Bonds",
    "bonds/grants":        "RFPs/Grants/Bonds",
    "vendor selection":    "RFPs/Grants/Bonds",
    "leadership changes":  "Leader & Strategic Initiatives",
    "strategic initiatives": "Leader & Strategic Initiatives",
  };

  const sourceTagIdx   = cols.indexOf("Source Tags");
  const categoryTagIdx = cols.indexOf("Category Tags");

  // Find the customer_id column regardless of exact casing/spacing used in the table
  const CUSTOMER_ID_VARIANTS = [
    "customer_id", "Customer Id", "Customer ID", "CustomerID",
    "internal_customer_id", "Internal Customer Id", "Internal Customer ID",
  ];
  const customerIdCol = cols.find((c: string) => CUSTOMER_ID_VARIANTS.includes(c)) ?? null;

  const allRows: Record<string, unknown>[] = rawRows.map((row) => {
    const entry = Object.fromEntries(cols.map((col, i) => [col, row[i]]));
    if (sourceTagIdx >= 0 && typeof entry["Source Tags"] === "string") {
      const normalized = SOURCE_TAG_MAP[entry["Source Tags"].trim().toLowerCase()];
      if (normalized) entry["Source Tags"] = normalized;
    }
    if (categoryTagIdx >= 0 && typeof entry["Category Tags"] === "string") {
      const normalized = CATEGORY_TAG_MAP[entry["Category Tags"].trim().toLowerCase()];
      if (normalized) entry["Category Tags"] = normalized;
    }
    return entry;
  });

  // Filter to Right at School (internal customer id = '0001') when the column exists
  const rows = customerIdCol
    ? allRows.filter((r) => String(r[customerIdCol] ?? "").trim() === "0001")
    : allRows;

  memCache = { rows, columns: cols };
  memCacheAt = Date.now();
  return memCache;
}

export async function GET() {
  try {
    const { rows, columns } = await fetchSignals();
    // Serve from in-memory cache only — no CDN caching so stale data from the
    // old Card 432 source is never served after a source change.
    return NextResponse.json({ rows, columns }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [], columns: [] }, { status: 500 });
  }
}
