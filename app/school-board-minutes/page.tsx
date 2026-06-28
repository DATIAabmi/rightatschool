"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import QuestionEmbed from "@/components/QuestionEmbed";
import { useFilter } from "@/components/FilterContext";

function SchoolBoardContent() {
  const searchParams = useSearchParams();
  const urlDistrict = searchParams.get("district");
  const { setDistrict } = useFilter();

  // When navigated here via district drill-through (?district=...), pre-populate
  // the district field in the header and pass it into the question.
  useEffect(() => {
    if (urlDistrict) setDistrict(urlDistrict);
  }, [urlDistrict, setDistrict]);

  return (
    <MetabaseProviderWrapper>
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
        <div style={{ flex: 1, minHeight: 0 }}>
          <QuestionEmbed
            questionId={425}
            campaignSqlKey="abmi_campaign"
            districtSqlKey="District"
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
