"use client";

import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

const STYLES = `
  /* Strip chrome from KPI scalars only */
  .leads-kpi > div,
  .leads-kpi [class*="DashCard"],
  .leads-kpi [class*="dashcard"],
  .leads-kpi .metabase-embed-frame {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .leads-kpi header,
  .leads-kpi [data-testid="legend-caption"] {
    display: none !important;
  }

  /* Charts: strip outer card border/shadow but keep Metabase's internal header */
  .leads-chart > div,
  .leads-chart .metabase-embed-frame {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
`;

function KPICard({ cardId, label, sqlParams }: {
  cardId: number;
  label: string;
  sqlParams: Record<string, string>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 pt-3 pb-2 flex flex-col" style={{ minHeight: 84 }}>
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <div className="leads-kpi flex-1 flex items-center" style={{ minHeight: 46 }}>
        <StaticQuestion questionId={cardId} sqlParameters={sqlParams} height={50} title={false} />
      </div>
    </div>
  );
}

function ChartCard({ cardId, sqlParams }: {
  cardId: number;
  sqlParams: Record<string, string>;
}) {
  return (
    <div className="leads-chart rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-1 min-w-0" style={{ height: 300 }}>
      <StaticQuestion questionId={cardId} sqlParameters={sqlParams} height={300} />
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

        {/* Right: 2 bar charts with native Metabase header */}
        <ChartCard cardId={178} sqlParams={sqlParams} />
        <ChartCard cardId={179} sqlParams={sqlParams} />
      </div>
    </div>
  );
}
