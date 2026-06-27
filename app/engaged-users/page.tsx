"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardEmbed from "@/components/DashboardEmbed";

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      {/*
        position:fixed fills exactly the viewport area to the right of the
        sidebar (w-64 = 16rem) from top to bottom — no dependency on parent
        padding or flex chains that can produce unexpected clientHeight values.
      */}
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
          <DashboardHeader legend="SBM - School Board Minutes. The SBM Link directs to the school board minutes document. | Topic is the intent signals based on content consumption. See Topic Insights dashboard. | Engagements are the number of clicks on your ads, email opens and lead downloads. | Intent Score is a numerical value that indicates a lead/district's likelihood to be in market derived from district data and total engagement on and off the DATIA K12 channels." />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DashboardEmbed
            dashboardId={76}
            autoTab="Engaged Users by District"
            dateParamSlug="select_date_range"
            campaignParamSlug="abmi_campaign_"
            fill
            linkColumn="District"
            rowColorColumn="Intent Score"
            stretchColumns
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
