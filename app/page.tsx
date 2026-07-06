"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel, { EcosystemFilterBar } from "@/components/EcosystemFunnel";
import ChannelPerformanceChart from "@/components/ChannelPerformanceChart";

function HomeContent() {
  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar spans full width above both sections */}
      <EcosystemFilterBar />

      {/* Section title bars */}
      <div className="flex gap-6 items-start">
        <div className="w-1/2 min-w-0 flex items-center gap-3">
          <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
            Program Metrics Summary
          </span>
        </div>
        <div className="w-1/2 min-w-0 flex items-center gap-3">
          <div className="w-1.5 h-7 bg-gray-900 rounded-sm shrink-0" />
          <span className="text-sm font-bold tracking-widest uppercase text-gray-800">
            Channel Performance By Engagements
          </span>
        </div>
      </div>

      {/* Two-column content */}
      <div className="flex gap-6 items-stretch">
        <div className="w-1/2 min-w-0">
          <EcosystemFunnel />
        </div>
        <div className="w-1/2 min-w-0">
          <ChannelPerformanceChart />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <MetabaseProviderWrapper>
      <DashboardHeader />
      <HomeContent />
    </MetabaseProviderWrapper>
  );
}
