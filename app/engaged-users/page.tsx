"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

// ─── Shared filter components ─────────────────────────────────────────────────

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
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">ABMi Campaign:</span>
        <span className="flex-1 text-left truncate text-blue-600 font-medium">{campaign || "All"}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1">
          <button onClick={() => { setCampaign(""); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!campaign ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
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

function DateRangeFilter() {
  const { dateStart, dateEnd, setDateStart, setDateEnd } = useFilter();
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
      <CalendarSearch size={14} className="text-orange-400 shrink-0" />
      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">Date Range:</span>
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

// ─── Live-search combobox ─────────────────────────────────────────────────────

function SearchDropdown({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "district" | "domain" | "state";
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
      <button onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[160px]">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">{label}:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value ? <span className="text-blue-600 font-medium">{value}</span> : <span className="text-gray-500">All</span>}
        </span>
        {value
          ? <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input ref={inputRef} type="text" placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => fetchOptions(e.target.value), 300); }}
              onKeyDown={handleKeyDown}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading && <p className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</p>}
            {!loading && options.length === 0 && query && <p className="px-4 py-3 text-xs text-gray-400 text-center">No results for &quot;{query}&quot;</p>}
            {!loading && options.length === 0 && !query && <p className="px-4 py-3 text-xs text-gray-400 text-center">Type to search</p>}
            {value && <button onClick={() => { onChange(""); setOpen(false); setQuery(""); }} className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50">Clear filter</button>}
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

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District",      index: 0 },
  { label: "Domain",        index: 1 },
  { label: "State",         index: 2 },
  { label: "Campaign",      index: 3 },
  { label: "Topic",         index: 5 },
  { label: "Engagements",   index: 6 },
  { label: "Engaged Users", index: 7 },
  { label: "Leads",         index: 8 },
  { label: "Downloads",     index: 9 },
  { label: "Intent Score",  index: 10 },
  { label: "Score Trend",   index: 11 },
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
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors">
        <ArrowUpDown size={13} className="text-gray-400" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sort by:</span>
        <span className="text-blue-600 font-medium">{current?.label ?? "Engagements"}</span>
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
// Columns 0 (District) and 1 (Domain) are left-aligned; all others center
const isLeftCol = (j: number) => j === 0 || j === 1;
const SCORE_TREND_COL = 11;

function rowBg(row: Row): string {
  const val = row[SCORE_TREND_COL];
  if (val === null || val === undefined || val === "") return "";
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return "";
  return n < 0 ? "rgba(239,68,68,0.13)" : "rgba(34,197,94,0.18)";
}

function DataTable({
  cols, rows, sort, onSort, onDistrictClick,
}: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
  onDistrictClick: (district: string) => void;
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
            <th className="px-3 py-2 w-12 text-xs font-bold" style={{ color: "#509EE3", textAlign: "center" }}>#</th>
            {cols.map((col, j) => {
              const active = sort.col === j;
              const left = isLeftCol(j);
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className="px-4 py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70"
                  style={{ color: "#509EE3", textAlign: left ? "left" : "center" }}>
                  <span className={`inline-flex items-center gap-1 ${left ? "justify-start" : "justify-center"}`}>
                    {col.display_name}
                    {active ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const bg = rowBg(row);
            return (
              <tr key={i} className="border-b border-gray-100" style={{ backgroundColor: bg || undefined }}>
                <td className="px-3 py-1.5 text-gray-500 text-xs font-medium" style={{ textAlign: "center" }}>{i + 1}</td>
                {row.map((cell, j) => {
                  const display = cell === null || cell === undefined ? "" : String(cell);
                  const left = isLeftCol(j);
                  return (
                    <td key={j} className={`px-4 py-1.5 text-gray-800 ${left ? "text-left" : "text-center tabular-nums"}`}>
                      {j === 0 ? (
                        <button onClick={() => onDistrictClick(display)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                          {display}
                        </button>
                      ) : display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EngagedUsersContent() {
  const router = useRouter();
  const { campaign, dateStart, dateEnd } = useFilter();

  const [district, setDistrict] = useState("");
  const [domain, setDomain] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 6, dir: "desc" });

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    // Pass short code only ("C6") — Metabase card uses STARTS_WITH filter
    const campaignCode = campaign ? campaign.split(":")[0].trim() : "";
    if (campaignCode) params.set("campaign", campaignCode);
    if (district)     params.set("district", district);
    if (domain)       params.set("domain",   domain);
    if (state)        params.set("state",    state);

    fetch(`/api/q405-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load data"); setLoading(false); });
  }, [campaign, district, domain, state]);

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

        {/* Row 2: District Domain + District + State */}
        <div className="flex items-center gap-2 mb-2">
          <SearchDropdown label="District Domain" field="domain"   value={domain}   onChange={setDomain} />
          <SearchDropdown label="District"         field="district" value={district} onChange={setDistrict} />
          <SearchDropdown label="State"            field="state"    value={state}    onChange={setState} />
        </div>

        {/* Legend */}
        <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 mb-3">
          <p><span className="font-bold text-gray-700">SBM</span> - School Board Minutes. The SBM Link directs to the school board minutes document.</p>
          <p><span className="font-bold text-gray-700">Topic</span> is the intent signals based on content consumption. See Topic Insights dashboard.</p>
          <p><span className="font-bold text-gray-700">Engagements</span> are the number of clicks on your ads, email opens and lead downloads.</p>
          <p><span className="font-bold text-gray-700">Intent Score</span> is a numerical value that indicates a lead/district&apos;s likelihood to be in market derived from district data and total engagement on and off the DATIA K12 channels.</p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll", overflowX: "hidden", padding: "0 24px 24px" }} className="eu-scroll">
        <style>{`.eu-scroll::-webkit-scrollbar{width:6px}.eu-scroll::-webkit-scrollbar-track{background:transparent}.eu-scroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}.eu-scroll::-webkit-scrollbar-thumb:hover{background:#9ca3af}`}</style>
        <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Engaged Users By District</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button onClick={() => exportToCsv("engaged-users-by-district", cols, rows)}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
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
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort}
              onDistrictClick={(d) => router.push(`/school-board-minutes?district=${encodeURIComponent(d)}`)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <EngagedUsersContent />
    </MetabaseProviderWrapper>
  );
}
