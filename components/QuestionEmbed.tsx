"use client";

import { InteractiveQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

interface Props {
  questionId: number;
  campaignSqlKey?: string;
  districtSqlKey?: string;
  dateStartSqlKey?: string;
  dateEndSqlKey?: string;
  /** Extra static SQL parameters passed as-is (e.g. { District_Domain: "", State: "" }). */
  staticParams?: Record<string, string>;
}

export default function QuestionEmbed({
  questionId,
  campaignSqlKey,
  districtSqlKey,
  dateStartSqlKey,
  dateEndSqlKey,
  staticParams,
}: Props) {
  const { campaign, district, dateStart, dateEnd } = useFilter();

  // campaignSqlKey is a required SQL template tag — block render if value is empty
  // to avoid Metabase's "missing required parameters" error.
  if (campaignSqlKey && !campaign) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 14 }}>
        Select an ABMi Campaign to load data.
      </div>
    );
  }

  const sqlParameters: Record<string, string> = { ...staticParams };
  if (campaignSqlKey)  sqlParameters[campaignSqlKey]  = campaign;
  if (districtSqlKey)  sqlParameters[districtSqlKey]  = district;
  if (dateStartSqlKey) sqlParameters[dateStartSqlKey] = dateStart;
  if (dateEndSqlKey)   sqlParameters[dateEndSqlKey]   = dateEnd;

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <InteractiveQuestion
        key={JSON.stringify(sqlParameters)}
        questionId={questionId}
        initialSqlParameters={sqlParameters}
        withTitle={false}
        style={{ height: "100%" }}
      >
        <InteractiveQuestion.QuestionVisualization height="100%" />
      </InteractiveQuestion>
    </div>
  );
}
