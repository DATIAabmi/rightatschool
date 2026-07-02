"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";

const CAMPAIGNS = [
  "C6: April - May 2026",
  "C5: Nov 2025 - May 2026",
  "C4: Aug - Sept 2025",
  "C3: June 2025",
  "C2: May - June 2025",
  "C1: April - May 2025",
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
        <span className="flex-1 text-left truncate text-blue-600 font-medium">{campaign}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1">
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

// ─── Sort dropdown ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

const SORT_COLUMNS = [
  { label: "District", index: 0 },
  { label: "State", index: 2 },
  { label: "Job Function", index: 3 },
  { label: "Campaign", index: 4 },
  { label: "Engagements", index: 5 },
  { label: "Leads", index: 6 },
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors"
      >
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
                onClick={() => {
                  onSort({ col: c.index, dir: active && sort.dir === "desc" ? "asc" : "desc" });
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${active ? "text-blue-600 font-semibold" : "text-gray-600"}`}
              >
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
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-3 text-right w-10 shrink-0 font-semibold" style={{ color: "#509EE3" }}>#</th>
            {cols.map((col, j) => {
              const isNum = NUMBER_TYPES.has(col.base_type);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 ${isNum ? "text-right" : "text-left"}`}
                  style={{ color: "#509EE3" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.display_name}
                    {active
                      ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                      : <ArrowUpDown size={11} className="opacity-30" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{i + 1}</td>
              {row.map((cell, j) => {
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                return (
                  <td key={j} className={`px-4 py-2.5 ${isNum ? "text-right tabular-nums" : "text-left"} text-gray-800`}>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function PersonaInsightsContent() {
  const { dateStart, dateEnd } = useFilter();

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" }); // default: Engagements desc

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd)   params.set("dateEnd",   dateEnd);

    fetch(`/api/q168-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [dateStart, dateEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />

        {/* Filter + sort bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CampaignDropdown />
            <DateRangeFilter />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {/* Legend */}
        <div className="text-xs text-gray-500 leading-relaxed mb-3">
          <p>All reporting elements on the page are interactive. The table can be filtered by using the filter in the top left or by selecting any table/chart bars. To reset filters, right click on filter table/chart and select <span className="font-bold text-gray-700">Reset Action</span> or <span className="font-bold text-gray-700">Reset the Page</span> at the top of the dashboard. The table can also be sorted by clicking on any header.</p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
        )}
        {!loading && !error && (
          <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <PersonaInsightsContent />
    </MetabaseProviderWrapper>
  );
}
