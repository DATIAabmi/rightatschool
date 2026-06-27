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
          <DashboardHeader />
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
