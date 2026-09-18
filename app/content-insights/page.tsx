"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportDivToPng } from "@/lib/exportChartToPng";

// ─── Types ────────────────────────────────────────────────────────────────────

// Card 205 cols: 0=Image 1=AssetName 2=AssetLink 3=Campaign 4=Impressions 5=Clicks 6=CTR
type GatedRow = [string, string, string, string, string, number | string, number | string, string];
type ChannelBreakdownRow = [string, number, number, number | string];
type ChannelClickRow = [string, number, number];

interface ContentData {
  impressions: number | null;
  clicks: number | null;
  ctr: string | null;
  channelBreakdown: ChannelBreakdownRow[];
  channelClicks: ChannelClickRow[];
}

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return String(v);
  return Math.round(n).toLocaleString();
}

function fmtPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return v.toFixed(2) + "%";
}

// ─── Scalar Card ──────────────────────────────────────────────────────────────

function ScalarCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-900 tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

// ─── Channel Breakdown Table ──────────────────────────────────────────────────

const COLORS = ["#509EE3", "#88BF4D", "#EF8C8C", "#F9D45C", "#A989C5", "#98D9D9"];

function channelColor(label: string, allLabels: string[]): string {
  const idx = allLabels.indexOf(label);
  return idx >= 0 ? COLORS[idx % COLORS.length] : "#d1d5db";
}

function ChannelBreakdownTable({ rows, activeChannel, onChannelClick }: {
  rows: ChannelBreakdownRow[];
  activeChannel: string | null;
  onChannelClick: (ch: string | null) => void;
}) {
  const headers = ["Channel", "Impressions", "Clicks", "CTR"];
  const labels = rows.map((r) => String(r[0] ?? ""));
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gray-900 text-white px-5 py-3">
        <span className="font-bold text-sm tracking-wide uppercase">Impressions &amp; Clicks by Channel</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {headers.map((h, i) => (
                <th key={h} className={`px-4 py-3 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: "#111827" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const ch = String(row[0] ?? "");
              const isActive = activeChannel === ch;
              const dimmed = activeChannel !== null && !isActive;
              const color = channelColor(ch, labels);
              return (
                <tr key={i}
                  onClick={() => onChannelClick(isActive ? null : ch)}
                  className="border-b border-gray-100 cursor-pointer transition-colors"
                  style={{ backgroundColor: isActive ? color + "18" : undefined, opacity: dimmed ? 0.4 : 1 }}>
                  <td className="px-4 py-3 text-left font-medium" style={{ color: isActive ? color : "#1f2937" }}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {ch}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800">{fmtNum(row[1])}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800">{fmtNum(row[2])}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800">{fmtPct(row[3])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

type DonutMode = "Clicks" | "Impressions" | "CTR";

function ClicksDonutChart({ rows, activeChannel, onChannelClick }: {
  rows: ChannelBreakdownRow[];
  activeChannel: string | null;
  onChannelClick: (ch: string | null) => void;
}) {
  const [mode, setMode] = useState<DonutMode>("Clicks");
  const cardRef = useRef<HTMLDivElement>(null);
  const R = 70, SW = 32, CX = 100, CY = 100;
  const circumference = 2 * Math.PI * R;

  const getValue = (row: ChannelBreakdownRow): number => {
    if (mode === "Impressions") return Number(row[1]) || 0;
    if (mode === "Clicks")      return Number(row[2]) || 0;
    return Number(row[3]) || 0; // CTR
  };

  const total = rows.reduce((s, r) => s + getValue(r), 0);

  // For CTR center: show weighted average (total clicks / total impressions)
  const totalImp = rows.reduce((s, r) => s + (Number(r[1]) || 0), 0);
  const totalClk = rows.reduce((s, r) => s + (Number(r[2]) || 0), 0);
  const avgCtr   = totalImp > 0 ? (totalClk / totalImp) * 100 : 0;

  let cumPct = 0;
  const segments = rows.map((row, i) => {
    const value = getValue(row);
    const pct = total > 0 ? value / total : 0;
    const arcStart = cumPct * circumference;
    cumPct += pct;
    return { label: String(row[0]), value, pct, arcStart, color: COLORS[i % COLORS.length] };
  });

  const activeIdx = activeChannel !== null ? segments.findIndex((s) => s.label === activeChannel) : -1;
  const activeSeg = activeIdx >= 0 ? segments[activeIdx] : null;

  const fmtValue = (v: number) =>
    mode === "CTR" ? v.toFixed(2) + "%" : Math.round(v).toLocaleString();

  const centerLabel = mode === "CTR" ? "Avg CTR" : `Total ${mode}`;
  const centerValue = mode === "CTR"
    ? avgCtr.toFixed(2) + "%"
    : Math.round(total).toLocaleString();

  const legendSub = (seg: (typeof segments)[number]) =>
    mode === "CTR"
      ? seg.value.toFixed(2) + "% CTR"
      : fmtValue(seg.value) + " " + mode.toLowerCase();

  const activeSubLabel = (seg: (typeof segments)[number]) =>
    mode === "CTR"
      ? seg.value.toFixed(2) + "% CTR"
      : fmtValue(seg.value) + " " + mode.toLowerCase();

  return (
    <div ref={cardRef} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Channel Performance</p>
        <div className="flex items-center gap-1">
          {(["Clicks", "Impressions", "CTR"] as DonutMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
              style={{ background: mode === m ? "#111827" : "#f3f4f6", color: mode === m ? "#fff" : "#6b7280" }}>
              {m}
            </button>
          ))}
          <button
            onClick={() => cardRef.current && exportDivToPng(cardRef.current, `channel-performance-${mode.toLowerCase()}`)}
            className="ml-2 text-gray-300 hover:text-gray-500 transition-colors"
            title="Export as PNG"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-8 w-full">
        <div className="shrink-0">
          <svg viewBox="0 0 200 200" width={180} height={180} style={{ cursor: "pointer" }}>
            <g transform={`rotate(-90 ${CX} ${CY})`}>
              {segments.map((seg, i) => {
                const isActive = activeIdx === i;
                const dimmed = activeChannel !== null && !isActive;
                return (
                  <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                    stroke={seg.color}
                    strokeWidth={isActive ? SW + 6 : SW}
                    strokeLinecap="butt"
                    strokeDasharray={`${seg.pct * circumference + 0.5} ${circumference}`}
                    strokeDashoffset={-seg.arcStart}
                    opacity={dimmed ? 0.25 : 1}
                    style={{ transition: "opacity 0.15s, stroke-width 0.15s", cursor: "pointer" }}
                    onClick={() => onChannelClick(activeChannel === seg.label ? null : seg.label)} />
                );
              })}
            </g>
            {activeSeg ? (
              <>
                <text x={CX} y={CY - 10} textAnchor="middle" fontSize={10} fill="#6b7280" fontFamily="inherit">{activeSeg.label}</text>
                <text x={CX} y={CY + 8} textAnchor="middle" fontSize={15} fontWeight="700" fill={activeSeg.color} fontFamily="inherit">
                  {(activeSeg.pct * 100).toFixed(1)}%
                </text>
                <text x={CX} y={CY + 22} textAnchor="middle" fontSize={10} fill="#9ca3af" fontFamily="inherit">
                  {activeSubLabel(activeSeg)}
                </text>
              </>
            ) : (
              <>
                <text x={CX} y={CY - 8} textAnchor="middle" fontSize={11} fill="#6b7280" fontFamily="inherit">{centerLabel}</text>
                <text x={CX} y={CY + 10} textAnchor="middle" fontSize={14} fontWeight="700" fill="#111827" fontFamily="inherit">
                  {centerValue}
                </text>
              </>
            )}
          </svg>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {segments.map((seg, i) => {
            const isActive = activeIdx === i;
            const dimmed = activeChannel !== null && !isActive;
            return (
              <div key={i} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 -mx-2 transition-colors"
                   style={{ backgroundColor: isActive ? seg.color + "18" : "transparent" }}
                   onClick={() => onChannelClick(activeChannel === seg.label ? null : seg.label)}>
                <div className="w-3 h-3 rounded-full shrink-0 transition-transform"
                     style={{ backgroundColor: seg.color, transform: isActive ? "scale(1.4)" : "scale(1)", opacity: dimmed ? 0.35 : 1 }} />
                <div className="flex-1 min-w-0" style={{ opacity: dimmed ? 0.35 : 1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${isActive ? "font-bold" : "font-medium text-gray-800"}`}
                          style={{ color: isActive ? seg.color : undefined }}>{seg.label}</span>
                    <span className="text-sm tabular-nums font-semibold shrink-0"
                          style={{ color: isActive ? seg.color : "#1f2937" }}>{(seg.pct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{legendSub(seg)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Gated Content Table ──────────────────────────────────────────────────────

function GatedContentTable({ campaign, dateStart, dateEnd, filterChannel }: { campaign: string[]; dateStart: string; dateEnd: string; filterChannel: string[] }) {
  const [rows, setRows] = useState<GatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 5, dir: "desc" });

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
    const params = new URLSearchParams();
    if (campaign.length)      params.set("campaign",  campaign.join(","));
    if (filterChannel.length) params.set("channel",   filterChannel.join(","));
    if (dateStart)            params.set("dateStart", dateStart);
    if (dateEnd)              params.set("dateEnd",   dateEnd);
    fetch(`/api/q205-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [campaign, filterChannel, dateStart, dateEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const HEADERS = [
    { label: "Image",             col: -1 },
    { label: "Asset Name & Link", col: 1 },
    { label: "Campaign",          col: 3 },
    { label: "Channel",           col: 4 },
    { label: "Impressions",       col: 5 },
    { label: "Clicks",            col: 6 },
    { label: "CTR",               col: 7 },
  ];

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const an = parseFloat(String(av)); const bn = parseFloat(String(bv));
    const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function handleSort(col: number) {
    if (col < 0) return;
    setSort((s) => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  }

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm" style={{ clipPath: "inset(0 round 0.75rem)" }}>
      <div ref={titleBarRef} className="sticky top-0 z-20 bg-gray-900 text-white px-5 py-3">
        <span className="font-bold text-sm tracking-wide uppercase">Gated Content Engagements</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 gap-2 text-gray-400 text-sm bg-white">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center justify-center h-40 text-red-500 text-sm bg-white">{error}</div>
      )}
      {!loading && !error && (
        <div className="bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {HEADERS.map((h) => (
                  <th key={h.label} onClick={() => handleSort(h.col)}
                    className={`sticky z-10 bg-white px-4 py-3 font-semibold whitespace-nowrap select-none border-b border-gray-200 ${h.col >= 0 ? "cursor-pointer hover:opacity-70" : ""} ${h.col === 3 || h.col === 4 ? "text-center" : h.col >= 5 ? "text-right" : "text-left"}`}
                    style={{ color: "#111827", top: titleBarHeight }}>
                    <span className={`inline-flex items-center gap-1 ${h.col === 3 || h.col === 4 ? "justify-center" : h.col >= 5 ? "justify-end" : "justify-start"}`}>
                      {h.label}
                      {h.col >= 0 && (
                        sort.col === h.col
                          ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                          : <ArrowUpDown size={11} className="opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-3 w-48">
                    {row[0] ? (
                      <img src={String(row[0])} alt={String(row[1] ?? "")} className="w-40 h-auto rounded object-cover" />
                    ) : (
                      <div className="w-40 h-24 bg-gray-100 rounded" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row[2] ? (
                      <a href={String(row[2])} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium leading-snug">
                        {String(row[1] ?? "")}
                        <ExternalLink size={12} className="mt-0.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-gray-800 font-medium">{String(row[1] ?? "")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700 text-xs font-medium">
                    {String(row[3] ?? "").split(",").map((c) => c.trim().split(":")[0].trim()).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap text-xs font-medium">
                    {String(row[4] ?? "")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{fmtNum(row[5])}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{fmtNum(row[6])}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{String(row[7] ?? "")}</td>
                </tr>
              ))}
              {sorted.length > 0 && (() => {
                const totalImp = sorted.reduce((s, r) => s + (parseFloat(String(r[5] ?? 0)) || 0), 0);
                const totalClk = sorted.reduce((s, r) => s + (parseFloat(String(r[6] ?? 0)) || 0), 0);
                const totalCtr = totalImp > 0 ? `${((totalClk / totalImp) * 100).toFixed(2)}%` : "—";
                return (
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-gray-900">Grand total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 whitespace-nowrap">{Math.round(totalImp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 whitespace-nowrap">{Math.round(totalClk).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 whitespace-nowrap">{totalCtr}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaign.length) params.set("campaign",  campaign.join(","));
    if (dateStart)       params.set("dateStart", dateStart);
    if (dateEnd)         params.set("dateEnd",   dateEnd);
    fetch(`/api/content-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d: ContentData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [campaign, dateStart, dateEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setFilterChannel([]);
    setActiveChannel(null);
  }, [resetSignal]);

  // Derive available channels from loaded data
  const availableChannels = data?.channelBreakdown.map((r) => String(r[0])) ?? [];

  // Apply channel filter client-side
  const filteredBreakdown: ChannelBreakdownRow[] = (data?.channelBreakdown ?? []).filter(
    (r) => filterChannel.length === 0 || filterChannel.includes(String(r[0]))
  ) as ChannelBreakdownRow[];

  const filteredClicks: ChannelClickRow[] = (data?.channelClicks ?? []).filter(
    (r) => filterChannel.length === 0 || filterChannel.includes(String(r[0]))
  ) as ChannelClickRow[];

  // Recalculate KPIs from filtered channel rows
  const filteredImpressions = filteredBreakdown.length
    ? filteredBreakdown.reduce((s, r) => s + (Number(r[1]) || 0), 0)
    : data?.impressions ?? null;
  const filteredClicksTotal = filteredBreakdown.length
    ? filteredBreakdown.reduce((s, r) => s + (Number(r[2]) || 0), 0)
    : data?.clicks ?? null;
  const filteredCtr = filteredImpressions && filteredClicksTotal
    ? ((filteredClicksTotal / filteredImpressions) * 100).toFixed(2) + "%"
    : data?.ctr ?? null;

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
        <div className="flex items-center gap-2 mb-3">
          <MultiSelectDropdown
            label="Channel"
            value={filterChannel}
            onChange={setFilterChannel}
            options={availableChannels}
            minWidth={160}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 24px 24px" }}>
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Summary scalars */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <ScalarCard label="Total Impressions" value={fmtNum(filteredImpressions)} />
              <ScalarCard label="Clicks" value={fmtNum(filteredClicksTotal)} />
              <ScalarCard label="CTR" value={filteredCtr ?? "—"} />
            </div>

            {/* Channel charts */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ChannelBreakdownTable rows={filteredBreakdown} activeChannel={activeChannel} onChannelClick={setActiveChannel} />
              <ClicksDonutChart rows={filteredBreakdown} activeChannel={activeChannel} onChannelClick={setActiveChannel} />
            </div>

            {/* Gated Content table */}
            <GatedContentTable campaign={campaign} dateStart={dateStart} dateEnd={dateEnd} filterChannel={filterChannel} />
          </>
        )}
      </div>
    </div>
  );
}
