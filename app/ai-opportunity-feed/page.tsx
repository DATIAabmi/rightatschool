"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Download, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtDate } from "@/lib/fmtDate";

type Signal = Record<string, unknown>;

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// Columns excluded from all display (handled explicitly or hidden)
const PRIMARY_COLS = new Set([
  "Signal Strength", "Action", "Ai Analysis", "AI Analysis",
  "City", "County", "Amount", "Confidence", "Verified Source Link",
  "Source Link", "Run Date", "Date", "Source Tags", "District", "Domain",
  "State", "Campaign", "Campaign #", "Sbm Link", "Sbm Date", "Sbm Context",
  "Nces ID", "Enrollment", "Curate Search Term", "Currated Search Term",
  "Internal Customer ID", "Category Tags",
]);

const GRID = "30px 110px 140px 40px 80px 82px 115px minmax(0,1fr)";
const GAP  = "0 8px";

export default function AIOpportunityFeed() {
  const [rows, setRows]       = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterSource,   setFilterSource]   = useState<string[]>([]);
  const [searchText,     setSearchText]     = useState("");

  const titleBarRef = useRef<HTMLDivElement>(null);
  const [titleBarHeight, setTitleBarHeight] = useState(0);

  useLayoutEffect(() => {
    const el = titleBarRef.current;
    if (!el) return;
    const measure = () => { const h = el.offsetHeight; if (h > 0) setTitleBarHeight(h); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/ai-signals-data?v=2")
      .then((r) => r.json())
      .then((d: { rows?: Signal[]; columns?: string[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message ?? "Failed to load"); setLoading(false); });
  }, []);

  const categoryOptions = [...new Set(rows.map((r) => String(r["Category Tags"] ?? "")).filter(Boolean))].sort();
  const sourceOptions   = [...new Set(rows.map((r) => String(r["Source Tags"]   ?? "")).filter(Boolean))].sort();

  // Resolve column names flexibly from actual API response
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const campaignKey = keys.find((k) => k.toLowerCase().startsWith("campaign")) ?? "Campaign #";
  const dateKey     = keys.find((k) => ["date", "run date"].includes(k.toLowerCase())) ?? "Date";
  const linkKey     = keys.find((k) => k.toLowerCase().includes("source link") || k.toLowerCase().includes("verified source") || k.toLowerCase().includes("sbm link")) ?? "Source Link";
  const contextKey  = keys.find((k) => k.toLowerCase().includes("search term") || k.toLowerCase().includes("ai analysis") || k.toLowerCase().includes("sbm context")) ?? "Currated Search Term";

  const q = searchText.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filterCategory.length && !filterCategory.includes((r["Category Tags"] as string) ?? "")) return false;
    if (filterSource.length   && !filterSource.includes((r["Source Tags"] as string) ?? ""))     return false;
    if (q) {
      const haystack = [
        r[contextKey], r.District, r.State, r[campaignKey],
        r["Source Tags"], r["Category Tags"],
        extractDomain(r[linkKey] as string),
      ].map((v) => String(v ?? "").toLowerCase()).join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const csvCols = Object.keys(rows[0] ?? {}).filter(k => !PRIMARY_COLS.has(k) || ["District","Domain","State","Campaign #","Date","Source Tags","Source Link","Currated Search Term","Category Tags"].includes(k))
    .map((k) => ({ display_name: k, base_type: "type/Text" }));
  const csvRows = filtered.map((r) => csvCols.map(c => r[c.display_name]));

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search district, state…"
              className="text-xs text-gray-700 bg-transparent border-none outline-none w-44 placeholder-gray-400"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="text-gray-300 hover:text-gray-500 ml-0.5 text-xs leading-none">✕</button>
            )}
          </div>
          <MultiSelectDropdown label="Category" value={filterCategory} onChange={setFilterCategory} options={categoryOptions} />
          <MultiSelectDropdown label="Source"   value={filterSource}   onChange={setFilterSource}   options={sourceOptions} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {/* Title bar with tab buttons */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Account Intelligence</span>
            {!loading && <span className="text-gray-400 text-xs">{filtered.length.toLocaleString()} signals</span>}
          </div>
          {!loading && filtered.length > 0 && (
            <button
              onClick={() => exportToCsv("ai-signals", csvCols as never, csvRows as never)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
            <Loader2 size={18} className="animate-spin" /> Loading AI signals…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm bg-white">
            {/* Column headers */}
            <div
              className="sticky z-10 bg-white border-b border-gray-200 grid text-xs font-semibold"
              style={{
                top: titleBarHeight,
                color: "#111827",
                gridTemplateColumns: GRID,
                gap: GAP,
                padding: "10px 20px",
              }}
            >
              <span>#</span>
              <span>District</span>
              <span>Domain</span>
              <span>State</span>
              <span>Campaign</span>
              <span>Date</span>
              <span>Source</span>
              <span>Signal Context</span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No signals match filters</div>
            ) : (
              filtered.map((row, i) => {
                const link   = row[linkKey] as string | null;
                const domain = (row["Domain"] as string) || extractDomain(link);
                const signalContext = String(row[contextKey] ?? "—");

                return (
                  <div
                    key={i}
                    className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
                    style={{ gridTemplateColumns: GRID, gap: GAP, padding: "12px 20px" }}
                  >
                    {/* # */}
                    <div className="text-xs text-gray-400 tabular-nums" style={{ paddingTop: 4 }}>
                      {i + 1}
                    </div>

                    {/* District */}
                    <div className="text-xs text-gray-700 leading-snug" style={{ paddingTop: 4 }}>
                      {(row.District as string) || "—"}
                    </div>

                    {/* Domain */}
                    <div className="min-w-0 overflow-hidden text-xs text-gray-600 leading-snug truncate" style={{ paddingTop: 4 }}>
                      {domain || "—"}
                    </div>

                    {/* State */}
                    <div className="text-xs text-gray-600" style={{ paddingTop: 4 }}>
                      {(row.State as string) || "—"}
                    </div>

                    {/* Campaign */}
                    <div className="text-xs text-gray-600 leading-snug" style={{ paddingTop: 4 }}>
                      {(row[campaignKey] as string) || "—"}
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-500 tabular-nums" style={{ paddingTop: 4 }}>
                      {fmtDate(row[dateKey])}
                    </div>

                    {/* Source Tags */}
                    <div className="text-xs text-gray-600 leading-snug" style={{ paddingTop: 4 }}>
                      {(row["Source Tags"] as string) || "—"}
                    </div>

                    {/* Signal Context */}
                    <div style={{ paddingTop: 3 }}>
                      <div className="text-xs text-gray-800 leading-relaxed break-words whitespace-normal">
                        {signalContext !== "—" ? signalContext : <span className="text-gray-400">—</span>}
                        {signalContext !== "—" && domain && link && (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 ml-1.5 text-blue-600 hover:text-blue-800 transition-colors align-baseline"
                            title={link}>
                            <span>{domain}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
