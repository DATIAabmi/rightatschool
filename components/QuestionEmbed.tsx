"use client";

import { InteractiveQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

interface Props {
  /** Metabase question ID to embed. */
  questionId: number;
  /** SQL template tag name for the ABMi Campaign filter (e.g. "ABM_Campaign"). */
  campaignSqlKey?: string;
  /** SQL template tag name for the District filter (e.g. "topic_district"). */
  districtSqlKey?: string;
  /** SQL template tag name for the date-range start (e.g. "Last_Updated.start"). */
  dateStartSqlKey?: string;
  /** SQL template tag name for the date-range end (e.g. "Last_Updated.end"). */
  dateEndSqlKey?: string;
}

export default function QuestionEmbed({
  questionId,
  campaignSqlKey,
  districtSqlKey,
  dateStartSqlKey,
  dateEndSqlKey,
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

  const sqlParameters: Record<string, string> = {};
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
