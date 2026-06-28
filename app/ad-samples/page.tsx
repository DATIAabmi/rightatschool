"use client";

import { useEffect, useRef, useState } from "react";
import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";

const TAB_LABEL = "Ad Samples";

function AdSamplesEmbed() {
  const { campaign } = useFilter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const params: Record<string, string> = {
    abmi_campaign_: campaign,
    channel: "",
    district: "",
    job_function: "",
    select_date_range: "",
    state: "",
    topic: "",
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let done = false;

    const tryClick = () => {
      if (done) return;

      // Search all button/anchor/role=tab elements for "Ad Samples"
      const candidates = container.querySelectorAll<HTMLElement>(
        '[role="tab"], button, a'
      );
      for (const el of candidates) {
        if (el.textContent?.trim() === TAB_LABEL) {
          el.click();
          done = true;
          // Give React/Metabase 800ms to swap the tab content, then show
          setTimeout(() => setReady(true), 800);
          return;
        }
      }
    };

    // Poll every 150ms — tab buttons appear async after SDK renders
    const interval = setInterval(tryClick, 150);

    // Safety: show after 8 s even if tab not found
    const fallback = setTimeout(() => {
      if (!done) { done = true; setReady(true); }
    }, 8000);

    return () => { clearInterval(interval); clearTimeout(fallback); };
  }, [campaign]);

  return (
    <>
      <style>{`
        /* Hide native filter bar — campaign comes from our DashboardHeader */
        .ad-samples-embed [data-testid="dashboard-parameters-widget-container"],
        .ad-samples-embed [class*="ParametersWidget"],
        .ad-samples-embed [class*="parameters-widget"],
        .ad-samples-embed [class*="ParameterWidget"] {
          display: none !important;
        }
        /* Remove top gap left by hidden filter bar */
        .ad-samples-embed [class*="DashboardBody"],
        .ad-samples-embed [class*="dashboard-body"],
        .ad-samples-embed [data-testid="dashboard-grid"] {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="ad-samples-embed"
        style={{ height: "100%", width: "100%", visibility: ready ? "visible" : "hidden" }}
      >
        <InteractiveDashboard
          key={campaign}
          dashboardId={35}
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
