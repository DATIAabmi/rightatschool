"use client";

import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

const STYLES = `
  .leads-kpi .metabase-embed-frame,
  .leads-chart .metabase-embed-frame {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  .leads-kpi header,
  .leads-chart header,
  .leads-kpi [data-testid="legend-caption"],
  .leads-chart [data-testid="legend-caption"] {
    display: none !important;
  }
  .leads-kpi > div > div,
  .leads-kpi [class*="DashCard"],
  .leads-kpi [class*="dashcard"] {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
`;

function KPICard({ cardId, label, sqlParams }: {
  cardId: number;
  label: string;
  sqlParams: Record<string, string>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-3 pb-2 flex flex-col" style={{ minHeight: 80 }}>
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <div className="leads-kpi flex-1 flex items-center" style={{ minHeight: 44 }}>
        <StaticQuestion questionId={cardId} sqlParameters={sqlParams} height={52} title={false} />
      </div>
    </div>
  );
}

function ChartCard({ cardId, label, sqlParams }: {
  cardId: number;
  label: string;
  sqlParams: Record<string, string>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-3 pb-1 flex flex-col flex-1 min-w-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <div className="leads-chart flex-1" style={{ minHeight: 180 }}>
        <StaticQuestion questionId={cardId} sqlParameters={sqlParams} height={188} title={false} />
      </div>
    </div>
  );
}

export default function LeadsSummaryPanel() {
  const { campaign, dateStart, dateEnd } = useFilter();

  const sqlParams: Record<string, string> = {};
  if (campaign) sqlParams["Abmi_Campaign"] = campaign;
  if (dateStart) sqlParams["Last_Updated.start"] = dateStart;
  if (dateEnd) sqlParams["Last_Updated.end"] = dateEnd;

  return (
    <div className="mb-4">
      <style>{STYLES}</style>
      <div className="flex gap-3 items-stretch">
        {/* Left column: 3 KPI scalars */}
        <div className="flex flex-col gap-3" style={{ width: 200, flexShrink: 0 }}>
          <KPICard cardId={175} label="Total Downloads" sqlParams={sqlParams} />
          <KPICard cardId={176} label="Total Unique Leads" sqlParams={sqlParams} />
          <KPICard cardId={177} label="Unique Lead District" sqlParams={sqlParams} />
        </div>

        {/* Right: 2 bar charts */}
        <ChartCard cardId={178} label="Leads by Content Type" sqlParams={sqlParams} />
        <ChartCard cardId={179} label="Leads by Content Name" sqlParams={sqlParams} />
      </div>
    </div>
  );
}
