"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

const KEYWORDS = ["after school", "child care", "head start", "enrichment"];

// ─── Live-search dropdown ─────────────────────────────────────────────────────

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
    setOpen((o) => !o); setQuery(""); setOptions([]);
    setTimeout(() => { inputRef.current?.focus(); fetchOptions(""); }, 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const target = options[0] ?? query.trim();
    if (!target) return;
    onChange(target); setOpen(false); setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[160px]">
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

// ─── Keyword dropdown (static) ────────────────────────────────────────────────

function KeywordDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[160px]">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex-shrink-0">Keyword:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value ? <span className="text-blue-600 font-medium capitalize">{value}</span> : <span className="text-gray-400">All</span>}
        </span>
        {value
          ? <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[180px] py-1">
          {value && (
            <button onClick={() => { onChange(""); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50">All keywords</button>
          )}
          {KEYWORDS.map((k) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm capitalize hover:bg-gray-50 ${value === k ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}>
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaign dropdown ────────────────────────────────────────────────────────

function CampaignDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[180px]">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">Campaign:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value ? <span className="text-blue-600 font-medium">{value}</span> : <span className="text-gray-400">All</span>}
        </span>
        {value
          ? <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[240px] py-1 max-h-72 overflow-y-auto">
          <button onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!value ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
            All campaigns
          </button>
          {CAMPAIGNS.map((c) => (
            <button key={c} onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${value === c ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-600"}`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

// Column order from card 425: 0=District 1=Campaign 2=District Domain 3=ST 4=SBM Date 5=Keyword 6=SBM Context 7=SBM Link
const SORT_COLUMNS = [
  { label: "District",  index: 0 },
  { label: "Campaign",  index: 1 },
  { label: "State",     index: 3 },
  { label: "SBM Date",  index: 4 },
  { label: "Keyword",   index: 5 },
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
        <span className="text-blue-600 font-medium">{current?.label ?? "SBM Date"}</span>
        <span className="text-gray-400 text-xs">{sort.dir === "asc" ? "↑" : "↓"}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] py-1">
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

function DataTable({ cols, rows, sort, onSort }: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
}) {
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm bg-white">No results</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="overflow-auto bg-white">
      <table className="text-sm border-collapse min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: "#509EE3" }}>#</th>
            {cols.map((col, j) => {
              const active = sort.col === j;
              const sortable = SORT_COLUMNS.some((s) => s.index === j);
              return (
                <th key={j}
                  onClick={() => sortable && onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`px-4 py-3 font-semibold whitespace-nowrap text-left ${sortable ? "cursor-pointer select-none hover:opacity-70" : ""}`}
                  style={{ color: "#509EE3" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.display_name}
                    {sortable && (active
                      ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      : <ArrowUpDown size={11} className="opacity-30" />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-1.5 text-right text-gray-400 text-xs whitespace-nowrap">{i + 1}</td>
              {row.map((cell, j) => {
                const val = cell === null || cell === undefined ? "" : String(cell);
                // SBM Link (index 7) — clickable link
                if (j === 7 && val) {
                  return (
                    <td key={j} className="px-4 py-1.5 text-left whitespace-nowrap">
                      <a href={val} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium">
                        View <ExternalLink size={11} />
                      </a>
                    </td>
                  );
                }
                // SBM Context (index 6) — allow wrapping for long text
                if (j === 6) {
                  return (
                    <td key={j} className="px-4 py-1.5 text-left text-gray-800" style={{ maxWidth: 320, minWidth: 160 }}>
                      <span className="line-clamp-2 block text-xs leading-relaxed">{val}</span>
                    </td>
                  );
                }
                // SBM Date (index 4) — strip ISO timestamp, show date only
                const display = j === 4 ? val.replace(/T.*$/, "") : val;
                return (
                  <td key={j} className="px-4 py-1.5 text-left text-gray-800 whitespace-nowrap">{display}</td>
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

function SchoolBoardContent() {
  const searchParams = useSearchParams();
  const urlDistrict = searchParams.get("district");
  const { campaign: ctxCampaign } = useFilter();

  const [filterCampaign, setFilterCampaign] = useState(ctxCampaign ?? "");
  const [filterDistrict, setFilterDistrict] = useState(urlDistrict ?? "");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 4, dir: "desc" }); // default: SBM Date desc

  const [allCols, setAllCols] = useState<Col[]>([]);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sync URL district param on navigation
  useEffect(() => {
    if (urlDistrict) setFilterDistrict(urlDistrict);
  }, [urlDistrict]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filterCampaign) params.set("campaign", filterCampaign);
    if (filterDistrict) params.set("district", filterDistrict);

    fetch(`/api/q425-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setAllCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [filterCampaign, filterDistrict]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filter: 0=District 1=Campaign 2=District Domain 3=ST 4=SBM Date 5=Keyword 6=SBM Context 7=SBM Link
  const filteredRows = allRows.filter((row) => {
    if (filterDomain  && String(row[2] ?? "").toLowerCase() !== filterDomain.toLowerCase())  return false;
    if (filterState   && String(row[3] ?? "").toLowerCase() !== filterState.toLowerCase())   return false;
    if (filterKeyword && String(row[5] ?? "").toLowerCase() !== filterKeyword.toLowerCase()) return false;
    return true;
  });

  return (
    <MetabaseProviderWrapper>
      <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                    display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
        <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
          <DashboardHeader />

          {/* Filter + sort bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CampaignDropdown value={filterCampaign} onChange={setFilterCampaign} />
              <SearchDropdown label="District" field="district" value={filterDistrict} onChange={setFilterDistrict} />
              <SearchDropdown label="Domain"   field="domain"   value={filterDomain}   onChange={setFilterDomain} />
              <SearchDropdown label="State"    field="state"    value={filterState}    onChange={setFilterState} />
              <KeywordDropdown value={filterKeyword} onChange={setFilterKeyword} />
            </div>
            <SortDropdown sort={sort} onSort={setSort} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
          {/* Section title */}
          <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
            <span className="font-bold text-sm tracking-wide uppercase">School Board Minutes</span>
            {filteredRows.length > 0 && (
              <button
                onClick={() => exportToCsv("school-board-minutes", allCols, filteredRows)}
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
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
                {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
              </div>
              <DataTable cols={allCols} rows={filteredRows} sort={sort} onSort={setSort} />
            </div>
          )}
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}

export default function SchoolBoardMinutesPage() {
  return (
    <Suspense>
      <SchoolBoardContent />
    </Suspense>
  );
}
