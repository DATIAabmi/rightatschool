"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download, Info, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
function fetchFieldOptions(field: "district" | "state") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
}

// Defined outside the component so it's a stable reference — only the
// returned function (which closes over `rows`) changes when rows change.
function makeSearchFn(rows: Row[], colIdx: number) {
  return (query: string): Promise<string[]> => {
    const ql = query.trim().toLowerCase();
    const opts = [...new Set(rows.map((r) => String(r[colIdx] ?? "")).filter(Boolean))].sort();
    return Promise.resolve((ql ? opts.filter((o) => o.toLowerCase().includes(ql)) : opts).slice(0, 200));
  };
}


// ─── Data types (used by table and chart) ─────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const LEFT_ALIGN_COLS = new Set(["District", "Domain", "District Domain", "Topic"]);
const FORCE_CENTER_COLS = new Set(["Campaign", "State"]);
const HEADER_LABELS: Record<string, string> = { "District Domain": "Domain" };
// Visual column order: District, Domain, State, Campaign, Date, Topic, Topic Score.
// Raw data order (card 181): 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic Score 6=Date
const COL_ORDER = [0, 1, 3, 2, 6, 4, 5];

// ─── AVG Topic Score chart ────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 66) return "#88BF4D";
  if (score >= 36) return "#F9D45C";
  return "#EF8C8C";
}

// Computes avg topic score and unique district count per topic from the filtered rows —
// so the chart automatically reflects every filter change with no extra fetch.
// Grid: topic grows to fit content (up to 420px), then fixed columns, bar fills rest
const CHART_GRID = "minmax(200px, 420px) 80px 55px 1fr";

function AvgTopicScoreChart({ rows, topicCol, scoreCol, districtCol, loading, selectedTopic, onTopicClick }: {
  rows: Row[]; topicCol: number; scoreCol: number; districtCol: number; loading: boolean;
  selectedTopic: string | null; onTopicClick: (topic: string | null) => void;
}) {
  const byTopic: Record<string, { sum: number; count: number; districts: Set<string> }> = {};
  for (const row of rows) {
    const topic = String(row[topicCol] ?? "");
    const score = Number(row[scoreCol]);
    const district = String(row[districtCol] ?? "");
    if (!topic || isNaN(score)) continue;
    if (!byTopic[topic]) byTopic[topic] = { sum: 0, count: 0, districts: new Set() };
    byTopic[topic].sum += score;
    byTopic[topic].count += 1;
    if (district) byTopic[topic].districts.add(district);
  }

  const sorted = Object.entries(byTopic)
    .map(([topic, { sum, count, districts }]) => ({ topic, score: sum / count, districtCount: districts.size }))
    .sort((a, b) => b.score - a.score);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, gap: 8 }} className="text-gray-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (sorted.length === 0) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80 }} className="text-gray-400 text-sm">No data</div>;
  }

  const HDR: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af" };

  return (
    <div style={{ padding: "14px 20px 10px" }}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Average Score by Topic</p>
      {/* Headers */}
      <div style={{ display: "grid", gridTemplateColumns: CHART_GRID, borderBottom: "1px solid #e5e7eb", paddingBottom: 5, marginBottom: 2 }}>
        <span style={HDR}>Topic</span>
        <span style={HDR}>Districts</span>
        <span style={HDR}>Score</span>
        <span style={HDR}>Indicator</span>
      </div>
      {/* Rows */}
      {sorted.map(({ topic, score, districtCount }, i) => {
        const isSelected = selectedTopic === topic;
        return (
          <div
            key={i}
            onClick={() => onTopicClick(isSelected ? null : topic)}
            style={{
              display: "grid", gridTemplateColumns: CHART_GRID, alignItems: "center",
              borderBottom: "1px solid #f3f4f6", padding: "5px 0",
              cursor: "pointer",
              background: isSelected ? "#eff6ff" : undefined,
              borderRadius: isSelected ? 4 : undefined,
            }}
            className="hover:bg-gray-50 transition-colors"
          >
            <span style={{ fontSize: 12, color: isSelected ? "#1d4ed8" : "#374151", fontWeight: isSelected ? 600 : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 16 }} title={topic}>{topic}</span>
            <span style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>{districtCount}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{score.toFixed(1)}</span>
            <div style={{ paddingRight: 8 }}>
              <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${score}%`, backgroundColor: scoreColor(score), borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>
        Districts represents the number of unique districts researching each topic. Scores reflect average research intensity on a 0–100 scale.{selectedTopic ? " Click the highlighted row again to clear the filter." : " Click a topic to filter the table below."}
      </p>
    </div>
  );
}

// ─── Definitions modal ────────────────────────────────────────────────────────

const DEFINITIONS: { term: string; def: React.ReactNode }[] = [
  { term: "Filter",       def: "Filter by Campaign, Date Range, Organization, Domain, State, Date, or Topic." },
  { term: "Reset",        def: <>Click <strong>Reset Filters</strong> to clear all selected filters.</> },
  { term: "Sort",         def: <>Sort the table by clicking any column header or using the <strong>Sort By</strong> menu.</> },
  { term: "Export",       def: <>Use <strong>Export All</strong> to export data from all dashboard views. Use <strong>Export</strong> within an individual dashboard to export data from that view only.</> },
  { term: "Topic",        def: "A topic selected for monitoring based on the campaign and solution focus. Bombora intent signals are based on topics that organizations are researching." },
  { term: "Topic Score",  def: "Average score of an organization's total engagement with a topic. Bombora detects intent when a district shows a pattern of increased content consumption compared to its baseline. Low: 1≥35, Moderate: 36≥65, High: ≥66" },
];

function DefinitionsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onMouseDown={onClose} />
      <div
        style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: "1px solid #f0f0f0", padding: 24, maxWidth: 520, width: "calc(100% - 32px)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#111" }}>Dashboard Guide</span>
          <button type="button" onClick={onClose} style={{ color: "#9ca3af", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DEFINITIONS.map(({ term, def }) => (
            <div key={term} style={{ display: "flex", gap: 12 }}>
              <span className="font-bold" style={{ fontSize: 12, color: "#111", flexShrink: 0, minWidth: 140, paddingTop: 1 }}>{term}</span>
              <span style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Sort dropdown ─────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "Domain", index: 1 },
  { label: "State", index: 3 },
  { label: "Campaign", index: 2 },
  { label: "Date", index: 6 },
  { label: "Topic", index: 4 },
  { label: "Topic Score", index: 5 },
];

function SortDropdown({ sort, onSort }: { sort: SortState; onSort: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_COLUMNS.find((c) => c.index === sort.col);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-semibold text-[13px]">{current?.label ?? "Topic Score"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          {SORT_COLUMNS.map((c) => {
            const active = sort.col === c.index;
            return (
              <button key={c.index}
                onClick={() => { onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c.label}
                {active && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

// Raw: 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic Score 6=Date
// Visual: # | District | Domain | State | Campaign | Date | Topic | Topic Score
const TI_COLS = [
  { label: "#",           width: 64,  align: "center" as const, colIdx: -1 },
  { label: "District",    width: 440, align: "left"   as const, colIdx: 0  },
  { label: "Domain",      width: 200, align: "left"   as const, colIdx: 1  },
  { label: "State",       width: 52,  align: "center" as const, colIdx: 3  },
  { label: "Campaign",    width: 90,  align: "center" as const, colIdx: 2  },
  { label: "Date",        width: 90,  align: "center" as const, colIdx: 6  },
  { label: "Topic",       width: 260, align: "left"   as const, colIdx: 4  },
  { label: "Topic Score", width: 110, align: "center" as const, colIdx: 5  },
];
const TI_GRID = TI_COLS.map(c => `${c.width}px`).join(" ");

function DataTable({ rows, sort, onSort }: {
  rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
}) {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No results</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="bg-white">
      {sorted.map((row, i) => (
        <div key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-xs"
             style={{ display: "grid", gridTemplateColumns: TI_GRID }}>
          <span className="px-2 py-1.5 text-center text-gray-400 font-medium">{i + 1}</span>
          {TI_COLS.slice(1).map((cd) => {
            const j = cd.colIdx;
            const cell = row[j];
            const text = cell === null || cell === undefined ? "" : String(cell);
            return (
              <span key={j} className="px-2 py-1.5 text-gray-800"
                    style={(cd.label === "Domain" || cd.label === "District" || cd.label === "Topic")
                      ? { textAlign: cd.align, overflowWrap: "anywhere" }
                      : { textAlign: cd.align, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                    title={text}>
                {text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const TOPIC_SKELETON_COLS = [28, 110, 90, 36, 70, 60, 130, 72];
const TOPIC_LOADING_MSGS = [
  "Fetching Bombora intent signals…",
  "Calculating topic scores…",
  "Loading district research data…",
  "Almost there…",
];

function SkeletonTable() {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setMsgIdx((i) => (i + 1) % TOPIC_LOADING_MSGS.length), 2800);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden bg-white">
      <style>{`
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .ti-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:1200px 100%;animation:shimmer 1.6s infinite linear}
      `}</style>
      <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shrink-0" />
        <span className="text-xs text-gray-500">{TOPIC_LOADING_MSGS[msgIdx]}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200">
        {TOPIC_SKELETON_COLS.map((w, i) => (
          <div key={i} className="ti-shimmer rounded" style={{ width: w, height: 10, flexShrink: 0 }} />
        ))}
      </div>
      {Array.from({ length: 14 }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
          {TOPIC_SKELETON_COLS.map((w, i) => (
            <div key={i} className="ti-shimmer rounded"
              style={{ width: Math.round(w * (0.5 + Math.random() * 0.5)), height: 9, flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function TopicInsightsContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterDomain, setFilterDomain] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterTopic, setFilterTopic] = useState<string[]>([]);
  const [filterCampaign, setFilterCampaign] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<string[]>([]);

  const [chartTopicFilter, setChartTopicFilter] = useState<string | null>(null);
  const [cols, setCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);

  // District options derived directly from allRows — updates automatically
  // whenever allRows changes (after API re-fetches with a state filter applied).
  const districtOptions = useMemo(
    () => [...new Set(allRows.map((r) => String(r[0] ?? "")).filter(Boolean))].sort(),
    [allRows]
  );

  // chartRows: used by the visualization — no chartTopicFilter so all topics stay visible
  // filterDistrict applied here (client-side) so allRows stays state-only-filtered for districtOptions
  const chartRows = useMemo(() => allRows.filter((r) => {
    if (filterDistrict.length && !filterDistrict.includes(String(r[0] ?? ""))) return false;
    if (filterDomain.length   && !filterDomain.includes(String(r[1] ?? "")))   return false;
    if (filterCampaign.length && !filterCampaign.includes(String(r[2] ?? ""))) return false;
    if (filterDate.length     && !filterDate.includes(String(r[6] ?? "")))     return false;
    return true;
  }), [allRows, filterDistrict, filterDomain, filterCampaign, filterDate]);
  // rows: used by the table — also applies the chart topic click filter
  const rows = useMemo(() => chartTopicFilter
    ? chartRows.filter((r) => String(r[4] ?? "") === chartTopicFilter)
    : chartRows,
  [chartRows, chartTopicFilter]);

  // useMemo so each search function is stable — only recreates when allRows changes.
  const searchDomains   = useMemo(() => makeSearchFn(allRows, 1), [allRows]);
  const searchCampaigns = useMemo(() => makeSearchFn(allRows, 2), [allRows]);
  const searchTopics    = useMemo(() => makeSearchFn(allRows, 4), [allRows]);
  const searchDates     = useMemo(() => makeSearchFn(allRows, 6), [allRows]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });
  const [showDefs, setShowDefs] = useState(false);

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

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign",   campaign.join(","));
    if (dateStart)             params.set("dateStart",  dateStart);
    if (dateEnd)               params.set("dateEnd",    dateEnd);
    if (filterState.length)    params.set("state",      filterState.join(","));
    if (filterTopic.length)    params.set("topic",      filterTopic.join(","));

    fetch(`/api/q181-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterState, filterTopic]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterDistrict([]);
    setFilterDomain([]);
    setFilterState([]);
    setFilterTopic([]);
    setFilterCampaign([]);
    setFilterDate([]);
    setChartTopicFilter(null);
  }, [resetSignal]);

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort row */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectDropdown label="District" value={filterDistrict} onChange={setFilterDistrict} options={districtOptions} searchable />
            <MultiSelectDropdown label="Domain"   value={filterDomain}   onChange={setFilterDomain}   search={searchDomains} />
            <MultiSelectDropdown label="State"    value={filterState}    onChange={setFilterState}    search={fetchFieldOptions("state")} />
            <MultiSelectDropdown label="Campaign" value={filterCampaign} onChange={setFilterCampaign} search={searchCampaigns} />
            <MultiSelectDropdown label="Date"     value={filterDate}     onChange={setFilterDate}     search={searchDates} />
            <MultiSelectDropdown label="Topic"    value={filterTopic}    onChange={setFilterTopic}    search={searchTopics} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDefs(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg bg-white transition-colors"
            >
              <Info size={13} />
              Dashboard Guide
            </button>
            <SortDropdown sort={sort} onSort={setSort} />
          </div>
        </div>

        {showDefs && <DefinitionsModal onClose={() => setShowDefs(false)} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", padding: "0 24px 24px" }}>
        <div style={{ minWidth: 1270, width: "100%" }}>

        {/* AVG Topic Score chart — driven by the same filtered rows as the table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
          <AvgTopicScoreChart
            rows={chartRows}
            topicCol={cols.findIndex((c) => c.display_name === "Topic")}
            scoreCol={cols.findIndex((c) => c.display_name === "Topic Score")}
            districtCol={cols.findIndex((c) => c.display_name === "District")}
            loading={loading}
            selectedTopic={chartTopicFilter}
            onTopicClick={setChartTopicFilter}
          />
        </div>

        {/* Section title */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Topic Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => {
                // Raw order (card 181): 0=District 1=Domain 2=Campaign 3=State 4=Topic 5=Topic_Score 6=Date
                // Desired: District, Domain, State, Campaign, Date, Topic, Topic Score
                const ORDER = [0, 1, 3, 2, 6, 4, 5];
                const exportCols = ORDER.map((i) => cols[i]).filter(Boolean);
                // Strip campaign description to just the C# code (e.g. "C7: July..." → "C7")
                const exportRows = rows.map((r) => ORDER.map((i) => {
                  if (i === 2) return String(r[i] ?? "").split(":")[0].trim();
                  return r[i];
                }));
                exportToCsv("DATIA ABMxi-Topic-Insights", exportCols, exportRows);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export
            </button>
          )}
        </div>

        {loading && <SkeletonTable />}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <>
            <div className="sticky z-10 bg-white border-b border-l border-r border-gray-200 text-[11px] font-semibold text-gray-700"
                 style={{ top: titleBarHeight, display: "grid", gridTemplateColumns: TI_GRID }}>
              {TI_COLS.map((cd, i) => (
                <span key={i}
                  className={`px-2 py-2 inline-flex items-center gap-0.5 whitespace-nowrap select-none ${cd.colIdx >= 0 ? "cursor-pointer hover:opacity-70" : ""} ${cd.align === "center" ? "justify-center" : "justify-start"}`}
                  onClick={cd.colIdx >= 0 ? () => setSort({ col: cd.colIdx, dir: sort.col === cd.colIdx && sort.dir === "desc" ? "asc" : "desc" }) : undefined}>
                  {cd.label}
                  {cd.colIdx >= 0 && (sort.col === cd.colIdx
                    ? (sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />)
                    : <ArrowUpDown size={10} className="opacity-30 shrink-0" />)}
                </span>
              ))}
            </div>
            <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ overflow: "clip" }}>
              <DataTable rows={rows} sort={sort} onSort={setSort} />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <TopicInsightsContent />;
}
