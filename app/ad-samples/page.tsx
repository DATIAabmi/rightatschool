"use client";

import { useEffect, useRef, useState } from "react";
import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";

const TAB_LABEL = "Ad Samples";

function hideTabBarAndHeader(container: HTMLElement) {
  // 1. Hide the tab bar — click already happened so this is safe
  container.querySelectorAll<HTMLElement>(
    '[role="tablist"], [data-testid="dashboard-tabs"], [class*="DashboardTabs"]'
  ).forEach((el) => { el.style.display = "none"; });

  // 2. Hide the ABMi Always On branding header cards
  const cards = container.querySelectorAll<HTMLElement>(
    '[class*="DashCard"], [class*="dashcard"], [data-testid*="dashcard"]'
  );

  // Find the Y bottom of the branding row (cards containing known header text)
  // visibility:hidden keeps layout so getBoundingClientRect() works here
  let headerBottom = 0;
  for (const card of cards) {
    const text = (card.textContent ?? "").trim();
    if (text.includes("ABMi Always On") || text.includes("Last Update")) {
      const rect = card.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      headerBottom = Math.max(headerBottom, rect.bottom - parentRect.top);
    }
  }

  if (headerBottom > 0) {
    // Hide every card whose bottom sits within the header row
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      if (rect.bottom - parentRect.top <= headerBottom + 20) {
        (card as HTMLElement).style.visibility = "hidden";
      }
    }
  } else {
    // Fallback: hide small image-only cards (logos) at the very top
    for (const card of cards) {
      const text = (card.textContent ?? "").trim();
      const hasImg = card.querySelector("img") !== null;
      if (hasImg && text.length < 10 && card.offsetHeight < 150) {
        (card as HTMLElement).style.visibility = "hidden";
      }
    }
  }
}

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

      const candidates = container.querySelectorAll<HTMLElement>(
        '[role="tab"], button, a'
      );
      for (const el of candidates) {
        if (el.textContent?.trim() === TAB_LABEL) {
          el.click();
          done = true;

          // Wait for Metabase to swap the tab content, then clean up and reveal
          setTimeout(() => {
            hideTabBarAndHeader(container);
            setReady(true);
          }, 1200);

          return;
        }
      }
    };

    const interval = setInterval(tryClick, 150);
    const fallback = setTimeout(() => {
      if (!done) {
        done = true;
        if (containerRef.current) hideTabBarAndHeader(containerRef.current);
        setReady(true);
      }
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
