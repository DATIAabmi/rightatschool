"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import { StaticQuestion } from "@metabase/embedding-sdk-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

const TOPICS = [
  "After-School Care Programs",
  "Back-up Child Care",
  "Bright Horizons Family Solutions Inc. (BFAM)",
  "Care for Kids",
  "Child Care",
  "Child Care Subsidy Programs",
  "Contract Renewal",
  "Early Childhood Education",
  "Request For Proposal (RFP)",
  "Social Learning",
  "Social and Emotional Learning",
  "Student Support Services",
  "Supervised Learning",
  "Third-Party Vendors",
];

// ─── Campaign dropdown ────────────────────────────────────────────────────────

function CampaignDropdown() {
  const { campaign, setCampaign } = useFilter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[220px]"
      >
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">ABMi Campaign:</span>
        <span className="flex-1 text-left truncate text-blue-600 font-medium">{campaign || "All"}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1">
          <button
            onClick={() => { setCampaign(""); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!campaign ? "text-blue-600 font-semibold" : "text-gray-600"}`}
          >
            All campaigns
          </button>
          {CAMPAIGNS.map((c) => (
            <button key={c} onClick={() => { setCampaign(c); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${campaign === c ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Date range filter ────────────────────────────────────────────────────────

function DateRangeFilter() {
  const { dateStart, dateEnd, setDateStart, setDateEnd } = useFilter();
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
      <CalendarSearch size={14} className="text-orange-400 flex-shrink-0" />
      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex-shrink-0">Date Range:</span>
      <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
        className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
      <span className="text-gray-300 text-xs">–</span>
      <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
        className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer" />
      {(dateStart || dateEnd) && (
        <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="text-gray-300 hover:text-gray-500 ml-0.5">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Live-search dropdown for district / state ────────────────────────────────

function SearchDropdown({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "district" | "state";
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchOptions = useCallback((q: string) => {
    setLoading(true);
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => { setOptions(d.values ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [field]);

  function handleOpen() {
    setOpen((o) => !o);
    setQuery("");
    setOptions([]);
    setTimeout(() => { inputRef.current?.focus(); fetchOptions(""); }, 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const target = options[0] ?? query.trim();
    if (!target) return;
    onChange(target);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[180px]"
      >
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex-shrink-0">{label}:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value ? <span className="text-blue-600 font-medium">{value}</span> : <span className="text-gray-400">All</span>}
        </span>
        {value
          ? <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input ref={inputRef} type="text" placeholder={`Search ${label.toLowerCase()}…`}
              value={query} onChange={(e) => { setQuery(e.target.value); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => fetchOptions(e.target.value), 300); }}
              onKeyDown={handleKeyDown}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading && <p className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</p>}
            {!loading && options.length === 0 && query && <p className="px-4 py-3 text-xs text-gray-400 text-center">No results for &quot;{query}&quot;</p>}
            {!loading && options.length === 0 && !query && <p className="px-4 py-3 text-xs text-gray-400 text-center">Type to search</p>}
            {value && (
              <button onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50">Clear filter</button>
            )}
            {options.map((opt) => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${value === opt ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Topic dropdown (static list) ─────────────────────────────────────────────

function TopicDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[180px]"
      >
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex-shrink-0">Topic:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value ? <span className="text-blue-600 font-medium">{value}</span> : <span className="text-gray-400">All</span>}
        </span>
        {value
          ? <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[280px] py-1 max-h-72 overflow-y-auto">
          <button onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!value ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
            All topics
          </button>
          {TOPICS.map((t) => (
            <button key={t} onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${value === t ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-600"}`}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sort dropdown ─────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "State", index: 3 },
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
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-medium">{current?.label ?? "Topic Score"}</span>
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

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);

function DataTable({ cols, rows, sort, onSort }: {
  cols: Col[]; rows: Row[];
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
    <div className="overflow-auto bg-white">
      <table className="text-sm border-collapse min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-right w-10 shrink-0 font-semibold" style={{ color: "#509EE3" }}>#</th>
            {cols.map((col, j) => {
              const isNum = NUMBER_TYPES.has(col.base_type);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 ${isNum ? "text-right" : "text-left"}`}
                  style={{ color: "#509EE3" }}>
                  <span className="inline-flex items-center gap-1">
                    {col.display_name}
                    {active ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-1.5 text-right text-gray-400 text-xs">{i + 1}</td>
              {row.map((cell, j) => {
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                return (
                  <td key={j} className={`px-4 py-1.5 ${isNum ? "text-right tabular-nums" : "text-left"} text-gray-800`}>
                    {cell === null || cell === undefined ? "" : String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function TopicInsightsContent() {
  const { campaign, dateStart, dateEnd } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign)       params.set("campaign",   campaign);
    if (dateStart)      params.set("dateStart",  dateStart);
    if (dateEnd)        params.set("dateEnd",    dateEnd);
    if (filterDistrict) params.set("district",   filterDistrict);
    if (filterState)    params.set("state",      filterState);
    if (filterTopic)    params.set("topic",      filterTopic);

    fetch(`/api/q181-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterTopic]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Row 1: Campaign + Date Range + Sort */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CampaignDropdown />
            <DateRangeFilter />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {/* Row 2: District + State + Topic */}
        <div className="flex items-center gap-2 mb-2">
          <SearchDropdown label="District" field="district" value={filterDistrict} onChange={setFilterDistrict} />
          <SearchDropdown label="State"    field="state"    value={filterState}    onChange={setFilterState} />
          <TopicDropdown value={filterTopic} onChange={setFilterTopic} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>

        {/* Bombora description */}
        <div className="text-xs text-gray-600 leading-relaxed mb-3">
          <p>Bombora intent signals are based on topics that districts are researching. Bombora detects intent when a district shows a pattern of increased content consumption compared to its baseline.</p>
          <p><span className="font-bold text-gray-800">Topic Score</span> is the average score of a district&apos;s total engagement with a topic.</p>
          <p>Low: 1≥35, Moderate: 36≥65, High: ≥66</p>
        </div>

        {/* AVG Topic Score chart (Card 180) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden" style={{ height: 340 }}>
          <StaticQuestion
            key={campaign ?? "all"}
            questionId={180}
            title={false}
            height={340}
          />
        </div>

        {/* Section title */}
        <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Topic Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button
              onClick={() => exportToCsv("topic-insights", cols, rows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
        )}
        {!loading && !error && (
          <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <TopicInsightsContent />
    </MetabaseProviderWrapper>
  );
}
