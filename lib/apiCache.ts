import { NextResponse } from "next/server";

// Shared cache policy for API routes that proxy Metabase/BigQuery queries.
// Vercel's Edge Network caches the JSON response per full URL (query string
// included) for `maxAge` seconds, then serves stale data for up to
// `staleWhileRevalidate` more seconds while refetching in the background —
// so repeat requests for the same filters are near-instant instead of
// round-tripping through Metabase -> BigQuery every time.
const MAX_AGE = 60;
const STALE_WHILE_REVALIDATE = 300;

export function cachedJson<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status,
    headers: {
      "Cache-Control": `public, s-maxage=${MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    },
  });
}
