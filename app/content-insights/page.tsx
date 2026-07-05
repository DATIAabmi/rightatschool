"use client";

import { useEffect, useState } from "react";
import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";

// ─── Gated Content Table ──────────────────────────────────────────────────────

type GatedRow = [string, string, string, number | string, number | string, string];

type SortDir = "asc" | "desc";
interface SortState { col: number; dir: SortDir }

function formatNum(v: number | string): string {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return String(v);
  return Math.round(n).toLocaleString();
}

function GatedContentTable() {
  const [rows, setRows] = useState<GatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ col: 3, dir: "desc" });

  useEffect(() => {
    fetch("/api/q205-data")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  const HEADERS = [
    { label: "Image",            col: -1 },
    { label: "Asset Name & Link",col: 1 },
    { label: "Impressions",      col: 3 },
    { label: "Clicks",           col: 4 },
    { label: "CTR",              col: 5 },
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
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Header bar */}
      <div className="bg-gray-900 text-white px-5 py-3">
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
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    onClick={() => handleSort(h.col)}
                    className={`px-4 py-3 font-semibold text-left whitespace-nowrap select-none ${h.col >= 0 ? "cursor-pointer hover:opacity-70" : ""} ${h.col >= 3 ? "text-right" : "text-left"}`}
                    style={{ color: "#509EE3" }}
                  >
                    <span className={`inline-flex items-center gap-1 ${h.col >= 3 ? "justify-end" : "justify-start"}`}>
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
              {sorted.map((row, i) => {
                const imgUrl  = String(row[0] ?? "");
                const name    = String(row[1] ?? "");
                const link    = String(row[2] ?? "");
                const impr    = row[3];
                const clicks  = row[4];
                const ctr     = String(row[5] ?? "");
                return (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors align-top">
                    {/* Image */}
                    <td className="px-4 py-3 w-48">
                      {imgUrl ? (
                        <img src={imgUrl} alt={name} className="w-40 h-auto rounded object-cover" />
                      ) : (
                        <div className="w-40 h-24 bg-gray-100 rounded" />
                      )}
                    </td>
                    {/* Asset Name & Link */}
                    <td className="px-4 py-3">
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-start gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium leading-snug">
                          {name}
                          <ExternalLink size={12} className="mt-0.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-gray-800 font-medium">{name}</span>
                      )}
                    </td>
                    {/* Impressions */}
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{formatNum(impr)}</td>
                    {/* Clicks */}
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{formatNum(clicks)}</td>
                    {/* CTR */}
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800 whitespace-nowrap">{ctr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ContentInsightsContent() {
  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0,
                  display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
        <DashboardHeader />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 24px 24px" }}>
        {/* Summary scalars */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { id: 200, label: "Total Impressions" },
            { id: 201, label: "Clicks" },
            { id: 202, label: "CTR" },
          ].map(({ id, label }) => (
            <div key={id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
              <StaticQuestion questionId={id} title={false} height={60} />
            </div>
          ))}
        </div>

        {/* Channel performance charts */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[203, 204].map((id) => (
            <div key={id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <StaticQuestion questionId={id} title={false} height={280} />
            </div>
          ))}
        </div>

        {/* Gated Content custom table */}
        <GatedContentTable />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <ContentInsightsContent />
    </MetabaseProviderWrapper>
  );
}
