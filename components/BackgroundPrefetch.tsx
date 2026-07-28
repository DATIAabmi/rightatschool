"use client";

import { useEffect } from "react";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

// Routes to prefetch in priority order (first tab first, then rest).
// All use the default campaign so the most common view is warm immediately.
const PREFETCH_ROUTES = [
  // Tab 1: Ecosystem Insights (home page — funnel + channel chart)
  `/api/funnel-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  `/api/q363-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  // Tab 2: Engaged Users by District
  `/api/q405-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  // Tab 3: School Board Minutes
  `/api/q425-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  // Tab 6: Leads Insights (summary + table)
  `/api/leads-summary?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  `/api/q174-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  // Tab 7: Topic Insights
  `/api/q181-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
  `/api/q180-data`,
  // Tab 8: Content Insights
  `/api/content-data?campaign=${encodeURIComponent(DEFAULT_CAMPAIGN)}`,
];

// Fire each request sequentially with a small gap so background prefetch
// doesn't saturate the server and slow down the active page.
async function prefetchSequentially() {
  for (const route of PREFETCH_ROUTES) {
    try {
      await fetch(route, { priority: "low" } as RequestInit);
    } catch {
      // ignore — prefetch is best-effort
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

export default function BackgroundPrefetch() {
  useEffect(() => {
    // Small delay so the active page's own fetches go first
    const t = setTimeout(prefetchSequentially, 2000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
