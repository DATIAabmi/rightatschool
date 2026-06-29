"use client";

import { useState, useRef, useEffect } from "react";
import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { ChevronDown, X, CalendarSearch } from "lucide-react";
import { useFilter } from "./FilterContext";

const CAMPAIGNS = [
  "C6: April - May 2026",
  "C5: Nov 2025 - May 2026",
  "C4: Aug - Sept 2025",
  "C3: June 2025",
  "C2: May - June 2025",
  "C1: April - May 2025",
];

interface FunnelStage {
  label: string;
  description: string;
  goal?: string;
  cardId: number;
  goalCardId?: number;
}

const STAGES: FunnelStage[] = [
  {
    label: "Impressions",
    description: "Number of times your content or ads were displayed on social, offsite display",
    goal: "Impression Goal: 300,000",
    cardId: 319,
    goalCardId: 300,
  },
  {
    label: "Engagements",
    description: "Number of clicks on your ads or opened emails",
    cardId: 320,
  },
  {
    label: "Click Thru Rate",
    description: "The percentage of people that click on a link or ad out of all the times they saw that ad",
    cardId: 323,
  },
  {
    label: "Engaged Users",
    description: "Unique users who viewed your content from all sources",
    cardId: 308,
  },
  {
    label: "Leads",
    description: "Total qualified leads generated across all channels",
    goal: "Goal: 300 Leads",
    cardId: 314,
    goalCardId: 305,
  },
];

const STEP = 36;
const CARD_W = 310;
const ROW_H = 108;

function InlineDateFilter() {
  const { dateStart, dateEnd, setDateStart, setDateEnd } = useFilter();
  const hasDate = dateStart || dateEnd;

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white">
      <CalendarSearch size={14} className="text-orange-400 flex-shrink-0" />
      <input
        type="date"
        value={dateStart}
        onChange={(e) => setDateStart(e.target.value)}
        className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer"
        title="Start date"
      />
      <span className="text-gray-300 text-xs">–</span>
      <input
        type="date"
        value={dateEnd}
        onChange={(e) => setDateEnd(e.target.value)}
        className="text-xs text-gray-700 bg-transparent border-none outline-none w-[110px] cursor-pointer"
        title="End date"
      />
      {hasDate && (
        <button
          onClick={() => { setDateStart(""); setDateEnd(""); }}
          className="text-gray-300 hover:text-gray-500 transition-colors ml-0.5"
          title="Clear dates"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function CampaignDropdown({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
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
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 hover:border-blue-400 transition-colors min-w-[220px]"
      >
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          ABMi Campaign:
        </span>
        <span className={`flex-1 text-left truncate ${value ? "text-blue-600 font-medium" : "text-gray-400"}`}>
          {value ?? "All campaigns"}
        </span>
        {value ? (
          <X
            size={14}
            className="text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
          />
        ) : (
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${!value ? "text-blue-600 font-semibold" : "text-gray-600"}`}
          >
            All campaigns
          </button>
          {CAMPAIGNS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${value === c ? "text-blue-600 font-semibold" : "text-gray-600"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EcosystemFunnel({
  campaign,
  onCampaignChange,
}: {
  campaign: string | null;
  onCampaignChange: (v: string | null) => void;
}) {
  const sqlParams = campaign ? { Abmi_Campaign: campaign } : undefined;

  return (
    <div className="w-full py-4 px-2">
      <style>{`
        .sdk-scalar {
          overflow: visible !important;
          width: 100%;
        }
        .sdk-scalar > div,
        .sdk-scalar > div > div,
        .sdk-scalar > div > div > div {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
        }
        .sdk-scalar header,
        .sdk-scalar [data-testid="legend-caption"] {
          display: none !important;
        }
        .sdk-scalar [class*="Visualization"],
        .sdk-scalar [class*="visualization"],
        .sdk-scalar [class*="CardVisualization"] {
          overflow: visible !important;
        }
        .dark-card .sdk-scalar span,
        .dark-card .sdk-scalar h1,
        .dark-card .sdk-scalar h2,
        .dark-card .sdk-scalar p,
        .dark-card .sdk-scalar div {
          color: white !important;
        }
      `}</style>

      {/* Section header + filter bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-9 bg-gray-900 rounded-sm" />
          <h2 className="text-sm font-bold tracking-widest uppercase text-gray-800">
            Program Metrics Summary
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <CampaignDropdown value={campaign} onChange={onCampaignChange} />
          <InlineDateFilter />
        </div>
      </div>

      {/* Funnel rows */}
      <div className="flex flex-col gap-1.5">
        {STAGES.map((stage, i) => {
          const indent = i * STEP;
          const isLast = i === STAGES.length - 1;

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
                className="dark-card bg-gray-950 text-white shrink-0 flex items-center"
                style={{
                  width: CARD_W,
                  borderRadius: isLast ? "0 6px 6px 0" : undefined,
                  padding: "0 16px",
                  gap: stage.goalCardId ? 10 : 0,
                }}
              >
                {/* Primary metric */}
                <div style={{ flex: 1, minWidth: 0, overflow: "visible" }}>
                  <span
                    className="block uppercase tracking-widest text-gray-400 font-semibold"
                    style={{ fontSize: 11, marginBottom: 2 }}
                  >
                    {stage.label}
                  </span>
                  <div className="sdk-scalar">
                    <StaticQuestion
                      questionId={stage.cardId}
                      showVisualization
                      title={false}
                      height={56}
                      initialSqlParameters={sqlParams}
                    />
                  </div>
                </div>

                {/* % to Goal column */}
                {stage.goalCardId && (
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
                    <div className="sdk-scalar">
                      <StaticQuestion
                        questionId={stage.goalCardId}
                        showVisualization
                        title={false}
                        height={56}
                        initialSqlParameters={sqlParams}
                      />
                    </div>
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
