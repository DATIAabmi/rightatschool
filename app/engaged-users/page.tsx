"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import QuestionEmbed from "@/components/QuestionEmbed";

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <div style={{
        position: "fixed",
        top: 0,
        left: "16rem",
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f9fafb",
        zIndex: 1,
      }}>
        <div style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
          <DashboardHeader />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <QuestionEmbed
            questionId={405}
            campaignSqlKey="ABM_Campaign"
            districtSqlKey="topic_district"
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
