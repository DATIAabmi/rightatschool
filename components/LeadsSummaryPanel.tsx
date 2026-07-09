"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

interface SummaryData {
  totalDownloads: number | null;
  totalUniqueLeads: number | null;
  uniqueLeadDistrict: number | null;
}

function fmt(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString();
}

function KPICard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-3 pb-3 flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-black text-gray-900 tabular-nums leading-none">{fmt(value)}</span>
    </div>
  );
}

function ChartCard({
  title,
  questionId,
  sqlParams,
}: {
  title: string;
  questionId: number;
  sqlParams: Record<string, string>;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 min-w-0 flex flex-col overflow-hidden"
      style={{ height: 280 }}
    >
      <div className="bg-gray-950 px-4 py-2.5 shrink-0">
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      <div className="flex-1 min-h-0">
        <StaticQuestion questionId={questionId} sqlParameters={sqlParams} height="100%" />
      </div>
    </div>
  );
}

export default function LeadsSummaryPanel() {
  const { campaign, dateStart, dateEnd } = useFilter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaign) params.set("campaign", campaign);
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd) params.set("dateEnd", dateEnd);
    fetch(`/api/leads-summary${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((d: SummaryData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [campaign, dateStart, dateEnd]);

  const sqlParams: Record<string, string> = {};
  if (campaign)  sqlParams["Abmi_Campaign"]      = campaign;
  if (dateStart) sqlParams["Last_Updated.start"] = dateStart;
  if (dateEnd)   sqlParams["Last_Updated.end"]   = dateEnd;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* Row 1: 3 KPI scalars side by side */}
      <div className="flex gap-3">
        {loading ? (
          <div className="flex items-center justify-center h-16 gap-2 text-gray-400 text-sm flex-1">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <>
            <KPICard label="Total Downloads"       value={data?.totalDownloads      ?? null} />
            <KPICard label="Total Unique Leads"    value={data?.totalUniqueLeads    ?? null} />
            <KPICard label="Unique Lead Districts" value={data?.uniqueLeadDistrict  ?? null} />
          </>
        )}
      </div>

      {/* Row 2: 2 Metabase embedded horizontal bar charts at full width */}
      <div className="flex gap-3">
        <ChartCard title="Leads by Content Type" questionId={178} sqlParams={sqlParams} />
        <ChartCard title="Leads by Content Name" questionId={179} sqlParams={sqlParams} />
      </div>
    </div>
  );
}
