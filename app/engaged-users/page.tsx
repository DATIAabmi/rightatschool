"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

function fetchFieldOptions(field: "district" | "domain" | "state") {
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

// Shorter/matches-reference labels so multi-word headers can wrap onto two
// lines instead of forcing extra column width.
const HEADER_LABELS: Record<string, string> = {
  Domain: "District Domain",
  State: "ST",
  Downloads: "Total Downloads",
  "Score Trend": "Intent Score Trend",
};

interface TrendColor { bg: string; text: string }

function trendColor(row: Row): TrendColor | null {
  const val = row[SCORE_TREND_COL];
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n) || n === 0) return null;
  return n < 0
    ? { bg: "rgba(239,68,68,0.10)", text: "#b91c1c" }
    : { bg: "rgba(34,197,94,0.14)", text: "#15803d" };
}

function DataTable({
  cols, rows, sort, onSort, onDistrictClick, headerTop = 0,
}: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
  onDistrictClick: (district: string) => void;
  headerTop?: number;
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
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-2 py-2 w-8 text-[11px] font-bold text-gray-900 border-b border-gray-200" style={{ textAlign: "center", top: headerTop }}>#</th>
            {cols.map((col, j) => {
              const active = sort.col === j;
              const left = isLeftCol(j);
              const label = HEADER_LABELS[col.display_name] ?? col.display_name;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className="sticky z-10 bg-white px-2 py-2 font-bold text-gray-900 cursor-pointer select-none hover:opacity-70 leading-tight border-b border-gray-200"
                  style={{ textAlign: left ? "left" : "center", top: headerTop }}>
                  <span className={`inline-flex items-center gap-0.5 ${left ? "justify-start" : "justify-center"}`}>
                    {label}
                    {active && (sort.dir === "asc" ? <ArrowUp size={10} className="shrink-0" /> : <ArrowDown size={10} className="shrink-0" />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const trend = trendColor(row);
            return (
              <tr key={i} className="border-b border-gray-100" style={{ backgroundColor: trend?.bg, color: trend?.text }}>
                <td className="px-2 py-1 text-gray-400 text-[11px] font-medium" style={{ textAlign: "center" }}>{i + 1}</td>
                {row.map((cell, j) => {
                  const display = cell === null || cell === undefined ? "" : String(cell);
                  const left = isLeftCol(j);
                  return (
                    <td key={j} className={`px-2 py-1 ${trend ? "" : "text-gray-800"} ${left ? "text-left" : "text-center tabular-nums"}`}>
                      {j === 0 ? (
                        <button onClick={() => onDistrictClick(display)}
                          className="block w-full text-left hover:underline font-medium"
                          style={{ color: trend?.text ?? "#2563eb" }}>
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
  const { campaign, setCampaign, dateStart, dateEnd } = useFilter();

  const [district, setDistrict] = useState<string[]>([]);
  const [domain, setDomain] = useState<string[]>([]);
  const [state, setState] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ col: 6, dir: "desc" });

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    // Pass short codes only ("C6") — Metabase card uses STARTS_WITH filter
    const campaignCodes = campaign.map((c) => c.split(":")[0].trim());
    if (campaignCodes.length) params.set("campaign", campaignCodes.join(","));
    if (district.length)      params.set("district", district.join(","));
    if (domain.length)        params.set("domain",   domain.join(","));
    if (state.length)         params.set("state",    state.join(","));

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
            <MultiSelectDropdown label="ABMi Campaign" value={campaign} onChange={setCampaign} options={[...CAMPAIGNS]} minWidth={220} />
            <DateRangeFilter />
          </div>
          <SortDropdown sort={sort} onSort={setSort} />
        </div>

        {/* Row 2: District Domain + District + State */}
        <div className="flex items-center gap-2 mb-2">
          <MultiSelectDropdown label="District Domain" value={domain}   onChange={setDomain}   search={fetchFieldOptions("domain")} />
          <MultiSelectDropdown label="District"         value={district} onChange={setDistrict} search={fetchFieldOptions("district")} />
          <MultiSelectDropdown label="State"            value={state}    onChange={setState}    search={fetchFieldOptions("state")} />
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
        <style>{`.eu-scroll::-webkit-scrollbar{width:10px}.eu-scroll::-webkit-scrollbar-track{background:#e5e7eb;border-radius:5px}.eu-scroll::-webkit-scrollbar-thumb{background:#6b7280;border-radius:5px}.eu-scroll::-webkit-scrollbar-thumb:hover{background:#374151}`}</style>
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
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
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ clipPath: "inset(0 round 0 0 0.75rem 0.75rem)" }}>
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight}
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
