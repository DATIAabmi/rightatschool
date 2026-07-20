"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { CalendarSearch, ChevronDown, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import UsStateChoropleth from "@/components/UsStateChoropleth";
import { exportToCsv } from "@/lib/exportCsv";
import { CAMPAIGNS } from "@/lib/campaigns";

function fetchFieldOptions(field: "district" | "state" | "job_function") {
  return (q: string) =>
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => d.values ?? []);
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
const LEFT_ALIGN_COLS = new Set(["District", "District Domain", "Job Function"]);
const HEADER_LABELS: Record<string, string> = { "District Domain": "Domain" };
// Visual column order: District, Domain, State, Campaign, then the rest as-is.
// Raw data order (card 168): 0=District 1=Domain 2=State 3=Job Function
// 4=Campaign 5=Engagements 6=Leads
const COL_ORDER = [0, 1, 2, 4, 3, 5, 6];

function DataTable({ cols, rows, sort, onSort, headerTop = 0 }: {
  cols: Col[]; rows: Row[];
  sort: SortState; onSort: (s: SortState) => void;
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
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky z-10 bg-white px-3 py-2 text-center w-10 font-semibold whitespace-nowrap border-b border-gray-200" style={{ color: "#509EE3", top: headerTop }}>#</th>
            {COL_ORDER.map((j) => {
              const col = cols[j];
              if (!col) return null;
              const isLeft = LEFT_ALIGN_COLS.has(col.display_name);
              const active = sort.col === j;
              return (
                <th key={j}
                  onClick={() => onSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                  className={`sticky z-10 bg-white px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 border-b border-gray-200 ${isLeft ? "text-left" : "text-center"}`}
                  style={{ color: "#509EE3", top: headerTop }}
                >
                  <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                    {HEADER_LABELS[col.display_name] ?? col.display_name}
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
              <td className="px-3 py-1.5 text-center text-gray-400 text-xs w-10 shrink-0">{i + 1}</td>
              {COL_ORDER.map((j) => {
                const cell = row[j];
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                const isLeft = LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                return (
                  <td key={j} className={`px-4 py-1.5 ${isLeft ? "text-left" : "text-center"} ${isNum ? "tabular-nums whitespace-nowrap" : ""} text-gray-800`}>
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

// ─── Engagements by Geography ──────────────────────────────────────────────────

type GeoRow = (string | number | null)[];
const GEO_LEFT_ALIGN_COLS = new Set<string>();

function GeographyTable({
  campaign, dateStart, dateEnd, filterDistrict, filterState,
}: {
  campaign: string[]; dateStart: string; dateEnd: string;
  filterDistrict: string[]; filterState: string[];
}) {
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<GeoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 2, dir: "desc" });

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (campaign.length)       params.set("campaign", campaign.join(","));
    if (dateStart)             params.set("dateStart", dateStart);
    if (dateEnd)               params.set("dateEnd", dateEnd);
    if (filterDistrict.length) params.set("district", filterDistrict.join(","));
    if (filterState.length)    params.set("state", filterState.join(","));

    fetch(`/api/q169-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setCols(d.cols ?? []); setRows(d.rows ?? []); setLoading(false); })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd, filterDistrict, filterState]);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const stateCol = cols.findIndex((c) => c.display_name === "State");
  const engagedUsersCol = cols.findIndex((c) => c.display_name === "Engaged Users");
  const valueByState: Record<string, number> = {};
  if (stateCol >= 0 && engagedUsersCol >= 0) {
    for (const row of rows) {
      const state = String(row[stateCol] ?? "");
      const value = Number(row[engagedUsersCol]) || 0;
      if (state) valueByState[state] = value;
    }
  }

  const totals = cols.map((col, j) => {
    if (j === stateCol) return "Grand total";
    if (!NUMBER_TYPES.has(col.base_type)) return "";
    return rows.reduce((sum, row) => sum + (Number(row[j]) || 0), 0);
  });

  const displayName = (name: string) => (name === "Leads" ? "Unique Leads" : name);

  return (
    <div className="mt-6">
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
        <span className="font-bold text-sm tracking-wide uppercase">Engagements By Geography</span>
        {rows.length > 0 && (
          <button
            onClick={() => exportToCsv("engagements-by-geography", cols, rows)}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center h-48 gap-2 text-gray-400 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center justify-center h-48 text-red-500 text-sm bg-white border border-t-0 border-gray-200 rounded-b-xl">{error}</div>
      )}
      {!loading && !error && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-white">No results</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 p-4">
              <div className="lg:w-1/2 shrink-0 flex items-center">
                <UsStateChoropleth valueByState={valueByState} />
              </div>
              <div className="lg:w-1/2 min-w-0 overflow-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-center w-10 font-semibold whitespace-nowrap" style={{ color: "#509EE3" }}>#</th>
                      {cols.map((col, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(col.display_name);
                        const active = sort.col === j;
                        return (
                          <th key={j}
                            onClick={() => setSort({ col: j, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                            className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-70 ${isLeft ? "text-left" : "text-center"}`}
                            style={{ color: "#509EE3" }}
                          >
                            <span className={`inline-flex items-center gap-1 ${isLeft ? "justify-start" : "justify-center"}`}>
                              {displayName(col.display_name)}
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
                        <td className="px-3 py-1.5 text-center text-gray-400 text-xs w-10 shrink-0">{i + 1}</td>
                        {row.map((cell, j) => {
                          const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                          const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                          return (
                            <td key={j} className={`px-4 py-1.5 ${isLeft ? "text-left" : "text-center"} ${isNum ? "tabular-nums" : ""} text-gray-800`}>
                              {cell === null || cell === undefined ? "" : String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="px-3 py-2"></td>
                      {totals.map((val, j) => {
                        const isLeft = GEO_LEFT_ALIGN_COLS.has(cols[j]?.display_name ?? "");
                        return (
                          <td key={j} className={`px-4 py-2 ${isLeft ? "text-left" : "text-center tabular-nums"} text-gray-900`}>
                            {typeof val === "number" ? val.toLocaleString() : val}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PersonaInsightsContent() {
  const { campaign, setCampaign, dateStart, dateEnd } = useFilter();

  const [filterDistrict, setFilterDistrict] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterJobFunction, setFilterJobFunction] = useState<string[]>([]);

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

  const [allRows, setAllRows] = useState<Row[]>([]);

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
    if (dateStart)              params.set("dateStart",   dateStart);
    if (dateEnd)                params.set("dateEnd",     dateEnd);
    if (filterDistrict.length)    params.set("district",    filterDistrict.join(","));
    if (filterState.length)       params.set("state",       filterState.join(","));
    if (filterJobFunction.length) params.set("jobFunction", filterJobFunction.join(","));

    fetch(`/api/q168-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setAllRows(d.rows);
        setLoading(false);
      })
      .catch((err) => { setError(err.message ?? "Failed to load"); setLoading(false); });
  }, [dateStart, dateEnd, filterDistrict, filterState, filterJobFunction]);

  // Card 168 has no template tags — filter campaign client-side.
  // Campaign column is at index 4 and stores short codes ("C6").
  useEffect(() => {
    const prefixes = campaign.map((c) => c.split(":")[0].trim());
    setRows(prefixes.length === 0 ? allRows : allRows.filter((row) => prefixes.includes(String(row[4] ?? ""))));
  }, [campaign, allRows]);

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
        <div className="flex items-center gap-2 mb-2">
          <MultiSelectDropdown label="District"     value={filterDistrict}    onChange={setFilterDistrict}    search={fetchFieldOptions("district")} />
          <MultiSelectDropdown label="Job Function" value={filterJobFunction} onChange={setFilterJobFunction} search={fetchFieldOptions("job_function")} />
          <MultiSelectDropdown label="State"        value={filterState}       onChange={setFilterState}       search={fetchFieldOptions("state")} />
        </div>

        {/* Legend */}
        <div className="text-xs text-gray-500 leading-relaxed mb-3">
          <p>All reporting elements on the page are interactive. The table can be filtered by using the filter in the top left or by selecting any table/chart bars. To reset filters, right click on filter table/chart and select <span className="font-bold text-gray-700">Reset Action</span> or <span className="font-bold text-gray-700">Reset the Page</span> at the top of the dashboard. The table can also be sorted by clicking on any header.</p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {/* Section title */}
        <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <span className="font-bold text-sm tracking-wide uppercase">Engagements By Persona Insights</span>
          {rows.length > 0 && (
            <button
              onClick={() => exportToCsv("persona-insights", cols, rows)}
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
          <div className="border border-t-0 border-gray-200 rounded-b-xl shadow-sm" style={{ clipPath: "inset(0 round 0 0 0.75rem 0.75rem)" }}>
            <DataTable cols={cols} rows={rows} sort={sort} onSort={setSort} headerTop={titleBarHeight} />
          </div>
        )}

        <GeographyTable
          campaign={campaign}
          dateStart={dateStart}
          dateEnd={dateEnd}
          filterDistrict={filterDistrict}
          filterState={filterState}
        />
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
