"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel from "@/components/EcosystemFunnel";
import ChannelPerformanceChart from "@/components/ChannelPerformanceChart";
import { useFilter } from "@/components/FilterContext";

function HomeContent() {
  const { campaign } = useFilter();

  return (
    <div className="flex gap-6 items-stretch">
      <div className="w-1/2 min-w-0">
        <EcosystemFunnel />
      </div>
      <div className="w-1/2 min-w-0">
        <ChannelPerformanceChart campaign={campaign} />
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
