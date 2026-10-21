"use client";

import Image from "next/image";
import { CalendarSearch, X, RotateCcw, LogOut, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { useFilter } from "@/components/FilterContext";
import { CAMPAIGNS, campaignDateRange } from "@/lib/campaigns";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

export default function DashboardHeader({ legend, onExport, exportLabel, hideDateRange }: { legend?: string; onExport?: () => Promise<void>; exportLabel?: string; hideDateRange?: boolean }) {
  const { campaign, setCampaign, dateStart, dateEnd, setDateStart, setDateEnd, resetAll } = useFilter();
  const [exporting, setExporting] = useState(false);

  function handleSignOut() {
    window.location.href = "/api/auth/logout";
  }

  async function handleExport() {
    setExporting(true);
    try {
      if (onExport) {
        await onExport();
        return;
      }
      const params = new URLSearchParams();
      if (campaign.length) params.set("campaign", campaign.join(","));
      if (dateStart) params.set("dateStart", dateStart);
      if (dateEnd)   params.set("dateEnd",   dateEnd);
      const res  = await fetch(`/api/export-excel?${params.toString()}`);
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? "datia-export.xlsx";
      const a    = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: name,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  const subtitle =
    campaign.length === 0
      ? "All Campaigns"
      : campaign.length === 1
      ? campaignDateRange(campaign[0])
      : `${campaign.length} Campaigns Selected`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-3 mb-4">
      <div className="flex items-center">
        {/* Left: Right At School logo */}
        <div className="flex-shrink-0 flex items-center gap-4">
          <Image
            src="/right-at-school-logo.png"
            alt="Right At School"
            width={652}
            height={306}
            style={{ height: "76px", width: "auto" }}
            className="object-contain"
          />
          {/* Vertical divider */}
          <div className="self-stretch w-px bg-gray-200 shrink-0" />
        </div>

        {/* Center: truly centered between logo and right edge */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1
            className="font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: "30px", letterSpacing: "-0.5px" }}
          >
            ABMxi Always On
          </h1>
          <p className="mt-1 font-medium" style={{ fontSize: "12px", color: "#6b8cba" }}>
            {subtitle}
          </p>
          <div className="h-0.5 bg-red-500 mt-1.5 rounded-full" style={{ width: 44 }} />
        </div>
      </div>

      {/* Global filters — Campaign + Date Range */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        <MultiSelectDropdown
          label="Campaign"
          value={campaign}
          onChange={setCampaign}
          options={[...CAMPAIGNS]}
          minWidth={220}
        />
        {!hideDateRange && <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <CalendarSearch size={14} className="text-orange-400 shrink-0" />
          <span className="text-gray-700 text-xs font-bold uppercase shrink-0">Date Range:</span>
          <select
            value={
              dateStart === "2026-09-01" && dateEnd === "2026-09-30" ? "sep-2026" :
              dateStart === "2026-08-01" && dateEnd === "2026-08-31" ? "aug-2026" :
              dateStart === "2026-07-01" && dateEnd === "2026-07-31" ? "jul-2026" :
              "custom"
            }
            onChange={(e) => {
              const presets: Record<string, [string, string]> = {
                "sep-2026": ["2026-09-01", "2026-09-30"],
                "aug-2026": ["2026-08-01", "2026-08-31"],
                "jul-2026": ["2026-07-01", "2026-07-31"],
              };
              const p = presets[e.target.value];
              if (p) { setDateStart(p[0]); setDateEnd(p[1]); }
            }}
            className="text-xs text-gray-600 bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="custom">{dateStart || dateEnd ? "Custom" : "Select month…"}</option>
            <option value="sep-2026">Sep 2026</option>
            <option value="aug-2026">Aug 2026</option>
            <option value="jul-2026">Jul 2026</option>
          </select>
          <div className="w-px h-3 bg-gray-200 shrink-0" />
          <div className="relative flex items-center">
            {!dateStart && <span className="absolute left-0 text-xs text-gray-400 pointer-events-none select-none">Start</span>}
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
              className={`text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer ${dateStart ? "w-[95px]" : "w-[30px] opacity-0"}`} />
          </div>
          <span className="text-gray-400 text-xs">–</span>
          <div className="relative flex items-center">
            {!dateEnd && <span className="absolute left-0 text-xs text-gray-400 pointer-events-none select-none">End</span>}
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
              className={`text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer ${dateEnd ? "w-[95px]" : "w-[28px] opacity-0"}`} />
          </div>
          {(dateStart || dateEnd) && (
            <button onClick={() => { setDateStart(""); setDateEnd(""); }} className="text-gray-300 hover:text-gray-500 ml-0.5">
              <X size={12} />
            </button>
          )}
        </div>}
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg bg-white transition-colors shrink-0 ml-auto"
          title="Reset all filters to default"
        >
          <RotateCcw size={13} />
          Reset Filters
        </button>
        <div className="relative group shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-300 hover:border-emerald-500 rounded-lg bg-white transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            {exporting ? "Exporting…" : (exportLabel ?? "Export All")}
          </button>
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Export to Excel
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-lg bg-white transition-colors shrink-0"
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {legend && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-0.5" style={{ fontFamily: "'Lato', sans-serif" }}>
          {legend.split(" | ").map((line, i) => (
            <p key={i} className="text-xs text-gray-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
