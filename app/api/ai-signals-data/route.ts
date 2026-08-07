import { NextResponse } from "next/server";
import { cachedJson } from "@/lib/apiCache";

export const maxDuration = 60;

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const API_KEY = process.env.METABASE_ADMIN_API_KEY!;
const CARD_ID = 432;

interface SignalCache { rows: Record<string, unknown>[]; columns: string[]; }
let memCache: SignalCache | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchSignals(): Promise<SignalCache> {
  if (memCache && Date.now() - memCacheAt < CACHE_TTL_MS) return memCache;

  const res = await fetch(`${METABASE_URL}/api/card/${CARD_ID}/query/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ parameters: [] }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Metabase error ${res.status}`);
  const rows: Record<string, unknown>[] = await res.json();
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  memCache = { rows, columns };
  memCacheAt = Date.now();
  return memCache;
}

export async function GET() {
  try {
    const { rows, columns } = await fetchSignals();
    return cachedJson({ rows, columns });
  } catch (err) {
    return NextResponse.json({ error: String(err), rows: [], columns: [] }, { status: 500 });
  }
}
