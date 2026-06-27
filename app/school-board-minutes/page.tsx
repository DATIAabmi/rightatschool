"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardEmbed from "@/components/DashboardEmbed";

function SchoolBoardContent() {
  const searchParams = useSearchParams();
  const district = searchParams.get("district");

  const extraParameters = district ? { topic_district: district } : undefined;

  return (
    <MetabaseProviderWrapper>
      <div className="-m-8 flex flex-col" style={{ height: "100vh" }}>
        <div className="px-8 pt-3 pb-1 flex-shrink-0">
          <DashboardHeader />
        </div>
        <div className="flex-1 min-h-0">
          <DashboardEmbed
            dashboardId={77}
            extraParameters={extraParameters}
            hideHeader
            fill
            compact
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}

export default function SchoolBoardMinutesPage() {
  return (
    <Suspense>
      <SchoolBoardContent />
    </Suspense>
  );
}
