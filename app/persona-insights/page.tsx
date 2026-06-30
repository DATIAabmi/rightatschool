"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import QuestionEmbed from "@/components/QuestionEmbed";

export default function Page() {
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
        <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
          <DashboardHeader />
          <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 mb-3">
            <p><span className="font-bold text-gray-700">SBM</span> - School Board Minutes. The SBM Link directs to the school board minutes document.</p>
            <p><span className="font-bold text-gray-700">Topic</span> is the intent signals based on content consumption. See Topic Insights dashboard.</p>
            <p><span className="font-bold text-gray-700">Engagements</span> are the number of clicks on your ads, email opens and lead downloads.</p>
            <p><span className="font-bold text-gray-700">Intent Score</span> is a numerical value that indicates a lead/district&apos;s likelihood to be in market derived from district data and total engagement on and off the DATIA K12 channels.</p>
            <p className="pt-0.5">All reporting elements on the page are interactive. The table can be filtered by using the filter in the top left or by selecting any table/chart bars. To reset filters, right click on filter table/chart and select <span className="font-bold text-gray-700">Reset Action</span> or <span className="font-bold text-gray-700">Reset the Page</span> at the top of the dashboard. The table can also be sorted by clicking on any header.</p>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <QuestionEmbed
            questionId={168}
            districtSqlKey="user_district"
            dateStartSqlKey="Last_Updated.start"
            dateEndSqlKey="Last_Updated.end"
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
