"use client";

import { StaticQuestion } from "@metabase/embedding-sdk-react";

export default function ChannelPerformanceChart({
  campaign,
}: {
  campaign?: string | null;
}) {
  const sqlParams = campaign ? { Abmi_Campaign: campaign } : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 h-full flex flex-col">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-4">
        Channel Performance By Engagements
      </h2>
      <div className="flex-1">
        <StaticQuestion
          questionId={363}
          showVisualization
          title={false}
          height={560}
          initialSqlParameters={sqlParams}
        />
      </div>
    </div>
  );
}
