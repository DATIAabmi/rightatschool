"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import LeadsSummaryPanel from "@/components/LeadsSummaryPanel";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

function fetchFieldOptions(field: "district" | "state" | "job_function") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
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

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District",        index: 0 },
  { label: "Campaign",        index: 2 },
  { label: "State",           index: 3 },
  { label: "Job Function",    index: 4 },
  { label: "Total Downloads", index: 5 },
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
        <span className="text-blue-600 font-medium">{current?.label ?? "Total Downloads"}</span>
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

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];
const NUMBER_TYPES = new Set(["type/Integer","type/BigInteger","type/Float","type/Decimal","type/Number"]);
const FORCE_CENTER_COLS = new Set(["Campaign", "State"]);

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
            <th className="px-3 py-2 w-12 text-xs font-bold" style={{ color: "#509EE3", textAlign: "center" }}>#</th>
            {cols.map((col, j) => {
              const isNum = NUMBER_TYPES.has(col.base_type);
              const isCenter = isNum || FORCE_CENTER_COLS.has(col.display_name);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className="px-4 py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70"
                  style={{ color: "#509EE3", textAlign: isCenter ? "center" : "left" }}>
                  <span className={`inline-flex items-center gap-1 ${isCenter ? "justify-center" : ""}`}>
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
              <td className="px-3 py-1.5 text-gray-500 text-xs font-medium" style={{ textAlign: "center" }}>{i + 1}</td>
              {row.map((cell, j) => {
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                const colName = cols[j]?.display_name ?? "";
                const isCenter = isNum || FORCE_CENTER_COLS.has(colName);
                return (
                  <td key={j} className={`px-4 py-1.5 text-gray-800 ${isNum ? "tabular-nums" : ""}`}
                    style={{ textAlign: isCenter ? "center" : "left" }}>
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

function LeadsInsightsContent() {
  const { campaign, setCampaign, dateStart, dateEnd } = useFilter();
  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)          params.set("campaign",    campaign.join(","));
    if (dateStart)                params.set("dateStart",   dateStart);
    if (dateEnd)                  params.set("dateEnd",     dateEnd);
    if (filterDistrict.length)    params.set("district",    filterDistrict.join(","));
    if (filterState.length)       params.set("state",       filterState.join(","));
    if (filterJobFunction.length) params.set("jobFunction", filterJobFunction.join(","));

    fetch(`/api/q174-data?${params.toString()}`)
      .then(async (r) => {
        const text = await r.text();
        if (!text.trim()) return { cols: [], rows: [] };
        return JSON.parse(text);
      })
      .then((d: { cols?: unknown[]; rows?: unknown[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setCols((d.cols ?? []) as Col[]);
        setRows((d.rows ?? []) as Row[]);
        setLoading(false);
      })
      .catch((err: Error) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState, filterJobFunction]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Row 1: Campaign + Date Range + Sort */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MultiSelectDropdown label="ABMi Campaign" value={campaign} onChange={setCampaign} options={[...CAMPAIGNS]} minWidth={220} />
            <DateRangeFilter />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {/* Row 2: District + Job Function + State */}
        <div className="flex items-center gap-2 mb-3">
          <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    search={fetchFieldOptions("district")} />
          <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
          <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        <LeadsSummaryPanel />
        <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase">Leads Insights</span>
            {!loading && rows.length > 0 && (
              <span className="text-gray-400 text-xs">{rows.length.toLocaleString()} records</span>
            )}
          </div>
          {rows.length > 0 && (
            <button onClick={() => exportToCsv("leads-insights", cols, rows)}
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
      <LeadsInsightsContent />
    </MetabaseProviderWrapper>
  );
}
