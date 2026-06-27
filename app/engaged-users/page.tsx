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
          {/*
            Dashboard 76, tab 166 already contains both:
              • card 405 – "Engaged Users by District-2 main query - Duplicate"
              • card 425 – "All School Board Minutes"
            Embedding the full tab gives both tables without a duplicate SBM embed.
          */}
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
