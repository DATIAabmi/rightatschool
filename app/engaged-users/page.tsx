"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardEmbed from "@/components/DashboardEmbed";

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      {/* -m-8 cancels the p-8 on <main> so this div sits flush against the
          sidebar and top edge. overflow-hidden prevents scroll bleed. */}
      <div className="-m-8 overflow-hidden" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flexShrink: 0, padding: "24px 32px 12px" }}>
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
