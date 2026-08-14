"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Download, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";

type Signal = Record<string, unknown>;

// Chip styling per column name
function chipStyle(label: string): React.CSSProperties {
  if (label === "Category Tags")
    return { background: "#EDE9FE", color: "#4C1D95", border: "1px solid #C4B5FD" };
  if (label === "Source Tags")
    return { background: "#ECFDF5", color: "#065F46", border: "1px solid #6EE7B7" };
  return { background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" };
}

// Columns rendered as dedicated grid cells — everything else becomes a tag chip
const PRIMARY_COLS = new Set([
  "Signal Strength",
  "Action",
  "Topic",
  "AI Analysis",
  "City",
  "County",
  "Amount ($)",
  "Confidence",
  "Verified Source Link",
]);

const ACTIONS = ["PURSUE", "MONITOR"];
const TOPICS  = ["Security & Access Control", "Construction & Renovation", "Safety Grants & Funding"];

function strengthColor(s: unknown): { bg: string; text: string } {
  const v = typeof s === "number" ? s : 0;
  if (v >= 8) return { bg: "#D4EFDF", text: "#145A32" };
  if (v >= 5) return { bg: "#FEF3CD", text: "#7A5800" };
  return { bg: "#F4E8E6", text: "#8A2010" };
}

function actionStyle(a: unknown): { bg: string; text: string; border: string } {
  if (a === "PURSUE")  return { bg: "#EAF6EE", text: "#1A7A4A", border: "#A8DFC0" };
  if (a === "MONITOR") return { bg: "#EEF3FB", text: "#1B5FAD", border: "#A8C5EB" };
  return { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" };
}

function confDot(c: unknown) {
  if (c === "high")   return "#1A7A4A";
  if (c === "medium") return "#D97706";
  return "#9CA3AF";
}

function fmtAmount(v: unknown): string {
  if (!v || typeof v !== "string") return "";
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return v;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return v.startsWith("$") ? v : `$${v}`;
}

export default function AIOpportunityFeed() {
  const [rows, setRows]       = useState<Signal[]>([]);
  const [tagCols, setTagCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [filterAction,   setFilterAction]   = useState<string[]>([]);
  const [filterTopic,    setFilterTopic]    = useState<string[]>([]);
  const [filterConf,     setFilterConf]     = useState<string[]>([]);
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
    fetch("/api/ai-signals-data")
      .then((r) => r.json())
      .then((d: { rows?: Signal[]; columns?: string[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows ?? []);
        // All columns from the database that aren't primary grid columns become tag chips
        setTagCols((d.columns ?? []).filter((c) => !PRIMARY_COLS.has(c)));
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message ?? "Failed to load"); setLoading(false); });
  }, []);

  const categoryOptions = [...new Set(rows.map((r) => String(r["Category Tags"] ?? "")).filter(Boolean))].sort();
  const sourceOptions   = [...new Set(rows.map((r) => String(r["Source Tags"]   ?? "")).filter(Boolean))].sort();

  const q = searchText.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (!r["AI Analysis"] || !r["Signal Strength"]) return false;
    if (filterAction.length   && !filterAction.includes((r.Action as string) ?? ""))       return false;
    if (filterTopic.length    && !filterTopic.includes((r.Topic as string) ?? ""))         return false;
    if (filterConf.length     && !filterConf.includes((r.Confidence as string) ?? ""))     return false;
    if (filterCategory.length && !filterCategory.includes((r["Category Tags"] as string) ?? "")) return false;
    if (filterSource.length   && !filterSource.includes((r["Source Tags"] as string) ?? ""))     return false;
    if (q) {
      const haystack = [r["AI Analysis"], r.City, r.County, r["Category Tags"], r["Source Tags"]]
        .map((v) => String(v ?? "").toLowerCase()).join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const csvCols = Object.keys(rows[0] ?? {}).map((k) => ({ display_name: k, base_type: "type/Text" }));
  const csvRows = filtered.map((r) => Object.values(r));

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Text search — searches district names, city, county, and analysis text */}
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
          <MultiSelectDropdown label="Category"   value={filterCategory} onChange={setFilterCategory} options={categoryOptions} />
          <MultiSelectDropdown label="Source"     value={filterSource}   onChange={setFilterSource}   options={sourceOptions} />
          <MultiSelectDropdown label="Action"     value={filterAction}   onChange={setFilterAction}   options={ACTIONS} />
          <MultiSelectDropdown label="Topic"      value={filterTopic}    onChange={setFilterTopic}    options={TOPICS} />
          <MultiSelectDropdown label="Confidence" value={filterConf}     onChange={setFilterConf}     options={["high", "medium", "low"]} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {/* Title bar */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">AI Opportunity Signals</span>
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
            {/* Column header */}
            <div
              className="sticky z-10 bg-white border-b border-gray-200 grid text-xs font-semibold"
              style={{
                top: titleBarHeight,
                color: "#111827",
                gridTemplateColumns: "52px 96px 100px minmax(0,1fr) 120px 80px 90px 40px",
                gap: "0 12px",
                padding: "10px 20px",
              }}
            >
              <span>Strength</span>
              <span>Action</span>
              <span>Topic</span>
              <span>AI Analysis</span>
              <span>Location</span>
              <span>Amount</span>
              <span>Confidence</span>
              <span></span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No signals match filters</div>
            ) : (
              filtered.map((row, i) => {
                const sc       = strengthColor(row["Signal Strength"]);
                const ac       = actionStyle(row.Action);
                const location = [row.City, row.County].filter(Boolean).join(", ");
                const amount   = fmtAmount(row["Amount ($)"]);
                const link     = row["Verified Source Link"] as string | null;

                // All tag cols that have a value — Category/Source Tags pinned first
                const PRIORITY = ["Category Tags", "Source Tags"];
                const chips = [
                  ...tagCols.filter((c) => PRIORITY.includes(c)),
                  ...tagCols.filter((c) => !PRIORITY.includes(c)),
                ]
                  .map((col) => ({ label: col, value: row[col] }))
                  .filter(({ value }) => value !== null && value !== undefined && value !== "");

                return (
                  <div
                    key={i}
                    className="grid border-b border-gray-100 hover:bg-gray-50 transition-colors items-start"
                    style={{
                      gridTemplateColumns: "52px 96px 100px minmax(0,1fr) 120px 80px 90px 40px",
                      gap: "0 12px",
                      padding: "12px 20px",
                    }}
                  >
                    {/* Signal Strength */}
                    <div style={{ paddingTop: 1 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: 6,
                        background: sc.bg, color: sc.text,
                        fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                      }}>
                        {(row["Signal Strength"] as number) ?? "—"}
                      </span>
                    </div>

                    {/* Action */}
                    <div style={{ paddingTop: 3 }}>
                      <span style={{
                        display: "inline-block", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.07em", padding: "3px 8px", borderRadius: 4,
                        background: ac.bg, color: ac.text, border: `1px solid ${ac.border}`,
                      }}>
                        {(row.Action as string) ?? "—"}
                      </span>
                    </div>

                    {/* Topic */}
                    <div className="text-xs text-gray-600 leading-snug" style={{ paddingTop: 4 }}>
                      {(row.Topic as string) ?? "—"}
                    </div>

                    {/* AI Analysis + dynamic tag chips */}
                    <div style={{ paddingTop: 3 }}>
                      <div className="text-xs text-gray-800 leading-relaxed">
                        {(row["AI Analysis"] as string) ?? "—"}
                      </div>
                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {chips.map(({ label, value }) => (
                            <span key={label} style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 10, lineHeight: 1, padding: "3px 7px", borderRadius: 4,
                              whiteSpace: "nowrap",
                              ...chipStyle(label),
                            }}>
                              <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>
                                {label}
                              </span>
                              <span style={{ fontWeight: 500 }}>{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Location */}
                    <div className="text-xs text-gray-500" style={{ paddingTop: 4 }}>
                      {location || "—"}
                    </div>

                    {/* Amount */}
                    <div className="text-xs font-semibold text-gray-800 tabular-nums" style={{ paddingTop: 4 }}>
                      {amount || "—"}
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-1.5" style={{ paddingTop: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: confDot(row.Confidence), flexShrink: 0, display: "inline-block" }} />
                      <span className="text-xs text-gray-500 capitalize">{(row.Confidence as string) ?? "—"}</span>
                    </div>

                    {/* Source link */}
                    <div style={{ paddingTop: 3 }}>
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="View verified source">
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
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
