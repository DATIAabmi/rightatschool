"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";

function AdSamplesEmbed() {
  const { campaign } = useFilter();

  const params: Record<string, string> = {
    abmi_campaign_: campaign,
    channel: "",
    district: "",
    job_function: "",
    select_date_range: "",
    state: "",
    topic: "",
  };

  return (
    <>
      <style>{`
        .ad-samples-embed [data-testid="dashboard-tabs"],
        .ad-samples-embed [role="tablist"],
        .ad-samples-embed [class*="DashboardTabs"],
        .ad-samples-embed [class*="Tab__"] {
          display: none !important;
        }
      `}</style>
      <div className="ad-samples-embed" style={{ height: "100%", width: "100%" }}>
        <InteractiveDashboard
          key={campaign}
          dashboardId={35}
          dashboardTabId={104}
          initialParameters={params}
          withTitle={false}
          style={{ height: "100%" }}
        />
      </div>
    </>
  );
}

export default function Page() {
  return (
    <MetabaseProviderWrapper>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "16rem",
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          background: "#f9fafb",
          zIndex: 1,
        }}
      >
        <div style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
          <DashboardHeader />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <AdSamplesEmbed />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
