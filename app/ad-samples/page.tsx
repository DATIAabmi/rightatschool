"use client";

import { useEffect, useRef, useState } from "react";
import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";

const TAB_LABEL = "Ad Samples";

/** Returns true if header cards were found and hidden. */
function cleanAdSamples(container: HTMLElement): boolean {
  // 1. Hide the tab bar — click already happened so this is safe
  container.querySelectorAll<HTMLElement>(
    '[role="tablist"], [data-testid="dashboard-tabs"], [class*="DashboardTabs"]'
  ).forEach((el) => { el.style.display = "none"; });

  const cards = Array.from(container.querySelectorAll<HTMLElement>(
    '[class*="DashCard"], [class*="dashcard"], [data-testid*="dashcard"]'
  ));

  if (cards.length === 0) return false;

  const containerRect = container.getBoundingClientRect();

  // 2. Identify the header row bottom via text-based cards
  let headerBottom = 0;
  for (const card of cards) {
    const text = (card.textContent ?? "").trim();
    if (text.includes("ABMi Always On") || text.includes("Last Update")) {
      const rect = card.getBoundingClientRect();
      headerBottom = Math.max(headerBottom, rect.bottom - containerRect.top);
    }
  }

  if (headerBottom === 0) return false; // cards not rendered yet — caller should retry

  // 3. Pass 1: hide every card that starts within the header row
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.top - containerRect.top < headerBottom) {
      card.style.visibility = "hidden";
    }
  }

  // 4. Pass 2: catch logo-only cards positioned just below (e.g. DATIA K12)
  const scanZone = Math.max(headerBottom * 2, 280);
  for (const card of cards) {
    if (card.style.visibility === "hidden") continue;
    const text = (card.textContent ?? "").trim();
    const hasImg = card.querySelector("img") !== null;
    if (!hasImg || text.length > 20) continue;
    const rect = card.getBoundingClientRect();
    if (rect.top - containerRect.top < scanZone) {
      card.style.visibility = "hidden";
    }
  }

  // 5. Eliminate the whitespace left by hidden cards.
  //    Find the topmost visible content card, then shift the grid up
  //    by that offset so content starts right at the top.
  let contentTop = Infinity;
  for (const card of cards) {
    if (card.style.visibility === "hidden") continue;
    const rect = card.getBoundingClientRect();
    contentTop = Math.min(contentTop, rect.top - containerRect.top);
  }

  if (contentTop > 0 && contentTop !== Infinity) {
    const gridEl = container.querySelector<HTMLElement>(
      '[class*="react-grid-layout"], [data-testid="dashboard-grid"] > *'
    );
    if (gridEl) {
      gridEl.style.marginTop = `-${Math.round(contentTop)}px`;
    }
  }

  return true;
}

function AdSamplesEmbed() {
  const { campaign } = useFilter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const params: Record<string, string | string[]> = {
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

    let clickDone = false;
    let cleanDone = false;

    // Step 1: poll for the "Ad Samples" tab button and click it
    const clickInterval = setInterval(() => {
      if (clickDone) return;
      const candidates = container.querySelectorAll<HTMLElement>('[role="tab"], button, a');
      for (const el of candidates) {
        if (el.textContent?.trim() === TAB_LABEL) {
          el.click();
          clickDone = true;
          clearInterval(clickInterval);

          // Step 2: after click, retry cleanAdSamples until cards are measured
          let attempts = 0;
          const tryClean = () => {
            if (cleanDone) return;
            const ok = cleanAdSamples(container);
            attempts++;
            if (ok || attempts >= 10) {
              cleanDone = true;
              setReady(true);
            } else {
              setTimeout(tryClean, 400);
            }
          };
          setTimeout(tryClean, 1000); // initial wait for tab content to render
          break;
        }
      }
    }, 150);

    // Safety fallback: show after 10 s no matter what
    const fallback = setTimeout(() => {
      if (!cleanDone) {
        cleanDone = true;
        if (containerRef.current) cleanAdSamples(containerRef.current);
        setReady(true);
      }
    }, 10_000);

    return () => { clearInterval(clickInterval); clearTimeout(fallback); };
  }, [campaign]);

  return (
    <>
      <style>{`
        /* Hide native Metabase filter bar */
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
          key={campaign.join(",")}
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
