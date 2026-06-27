"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardEmbed from "@/components/DashboardEmbed";

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <div className="-m-8 flex flex-col" style={{ height: "100vh" }}>
        <div className="px-8 pt-8 pb-4 flex-shrink-0">
          <DashboardHeader />
        </div>
        <div className="flex-1 min-h-0">
          <DashboardEmbed
            dashboardId={35}
            autoTab="Leads Insights"
            dateParamSlug="select_date_range"
            campaignParamSlug="abmi_campaign_"
            fill
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
