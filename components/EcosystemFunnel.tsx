"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, CalendarSearch, Loader2 } from "lucide-react";
import { useFilter } from "./FilterContext";
import { CAMPAIGNS } from "@/lib/campaigns";

const STEP = 36;
const CARD_W = 310;
const ROW_H = 108;

function fmt(val: string | number | null): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return Math.round(n).toLocaleString();
}

function goalPct(val: string | number | null): string | undefined {
  if (val === null || val === undefined) return undefined;
  return fmt(val);
}

interface FunnelData {
  impressions: string | number | null;
  impressionsGoal: string | number | null;
  engagements: string | number | null;
  ctr: string | number | null;
  engagedUsers: string | number | null;
  leads: string | number | null;
  leadsGoal: string | number | null;
}

interface Stage {
  label: string;
  description: string;
  goal?: string;
  value: string;
  goalValue?: string;
}

export function EcosystemFilterBar() {
  const { campaign: ctxCampaign, setCampaign: setCtxCampaign, dateStart, dateEnd, setDateStart, setDateEnd } = useFilter();
  const campaign = ctxCampaign || null;
  const setCampaign = (v: string | null) => setCtxCampaign(v ?? "");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const campaignRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (campaignRef.current && !campaignRef.current.contains(e.target as Node))
        setCampaignOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Campaign pill */}
      <div ref={campaignRef} className="relative">
        <button
          onClick={() => setCampaignOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors min-w-[220px]"
        >
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">ABMi Campaign:</span>
          <span className="flex-1 text-left truncate text-blue-600 font-medium">
            {campaign ?? "All campaigns"}
          </span>
          {campaign ? (
            <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0"
              onClick={(e) => { e.stopPropagation(); setCampaign(null); setCampaignOpen(false); }} />
          ) : (
            <ChevronDown size={14} className="text-gray-400 shrink-0" />
          )}
        </button>
        {campaignOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1">
            <button onClick={() => { setCampaign(null); setCampaignOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!campaign ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
              All campaigns
            </button>
            {CAMPAIGNS.map((c) => (
              <button key={c} onClick={() => { setCampaign(c); setCampaignOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${campaign === c ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date range pill */}
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
    </div>
  );
}

export default function EcosystemFunnel() {
  const { campaign, dateStart, dateEnd } = useFilter();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaign) params.set("campaign", campaign);
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd) params.set("dateEnd", dateEnd);
    const qs = params.toString();
    fetch(`/api/funnel-data${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, [campaign, dateStart, dateEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !data) {
    return <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error || "Failed to load"}</div>;
  }

  const stages: Stage[] = [
    {
      label: "Impressions",
      description: "Number of times your content or ads were displayed on social, offsite display",
      goal: "Impression Goal: 300,000",
      value: fmt(data.impressions),
      goalValue: goalPct(data.impressionsGoal),
    },
    {
      label: "Engagements",
      description: "Number of clicks on your ads or opened emails",
      value: fmt(data.engagements),
    },
    {
      label: "Click Thru Rate",
      description: "The percentage of people that click on a link or ad out of all the times they saw that ad",
      value: fmt(data.ctr),
    },
    {
      label: "Engaged Users",
      description: "Unique users who viewed your content from all sources",
      value: fmt(data.engagedUsers),
    },
    {
      label: "Leads",
      description: "Total qualified leads generated across all channels",
      goal: "Goal: 300 Leads",
      value: fmt(data.leads),
      goalValue: goalPct(data.leadsGoal),
    },
  ];

  return (
    <div className="w-full py-4 px-2">
      <div className="flex flex-col gap-1.5">
        {stages.map((stage, i) => {
          const indent = i * STEP;
          const isLast = i === stages.length - 1;

          return (
            <div key={stage.label} className="flex items-stretch" style={{ height: ROW_H }}>
              {/* Staircase spacer */}
              <div style={{ width: indent, flexShrink: 0 }} />

              {/* Gray chevron */}
              <div
                className="flex flex-col justify-center pl-8 bg-gray-200"
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingRight: isLast ? 28 : 44,
                  clipPath: isLast
                    ? "none"
                    : "polygon(0 0, 100% 0, calc(100% - 30px) 100%, 0 100%)",
                  borderRadius: isLast ? "6px 0 0 6px" : undefined,
                }}
              >
                <h3
                  className="font-black text-gray-900 leading-none"
                  style={{ fontSize: 22, letterSpacing: "-0.01em" }}
                >
                  {stage.label}
                </h3>
                <p className="text-gray-500 mt-0.5 leading-snug" style={{ fontSize: 11, maxWidth: 220 }}>
                  {stage.description}
                </p>
                {stage.goal && (
                  <p className="font-semibold text-green-600 mt-0.5" style={{ fontSize: 11 }}>
                    {stage.goal}
                  </p>
                )}
              </div>

              {/* Dark metric card */}
              <div
                className="bg-gray-950 text-white shrink-0 flex items-center"
                style={{
                  width: CARD_W,
                  borderRadius: isLast ? "0 6px 6px 0" : undefined,
                  padding: "0 16px",
                  gap: stage.goalValue ? 10 : 0,
                }}
              >
                {/* Primary metric */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="block uppercase tracking-widest text-gray-400 font-semibold"
                    style={{ fontSize: 11, marginBottom: 2 }}
                  >
                    {stage.label}
                  </span>
                  <span
                    className="block font-black text-white tabular-nums"
                    style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.02em" }}
                  >
                    {stage.value}
                  </span>
                </div>

                {/* % to Goal column */}
                {stage.goalValue && (
                  <div
                    className="shrink-0 border-l border-gray-700 flex flex-col"
                    style={{ paddingLeft: 10, minWidth: 96 }}
                  >
                    <span
                      className="block uppercase tracking-widest text-gray-400 font-semibold"
                      style={{ fontSize: 11, marginBottom: 2 }}
                    >
                      % to Goal
                    </span>
                    <span
                      className="block font-black text-white tabular-nums"
                      style={{ fontSize: 22, lineHeight: 1.1 }}
                    >
                      {stage.goalValue}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel tip triangle */}
      <div className="flex justify-end">
        <div
          className="bg-gray-950"
          style={{
            width: CARD_W,
            height: 20,
            clipPath: "polygon(15% 0, 85% 0, 50% 100%)",
          }}
        />
      </div>
    </div>
  );
}
