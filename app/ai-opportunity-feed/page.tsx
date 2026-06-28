"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";

function AIOpportunityEmbed() {
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <InteractiveDashboard
        dashboardId={79}
        withTitle={false}
        style={{ height: "100%" }}
      />
    </div>
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
          <AIOpportunityEmbed />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
