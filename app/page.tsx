"use client";

import { useState } from "react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import EcosystemFunnel from "@/components/EcosystemFunnel";
import ChannelPerformanceChart from "@/components/ChannelPerformanceChart";

export default function Home() {
  const [campaign, setCampaign] = useState<string | null>(null);

  return (
    <MetabaseProviderWrapper>
      <DashboardHeader campaign={campaign} />
      <div className="flex gap-6 items-stretch">
        <div className="w-1/2 min-w-0">
          <EcosystemFunnel campaign={campaign} onCampaignChange={setCampaign} />
        </div>
        <div className="w-1/2 min-w-0">
          <ChannelPerformanceChart campaign={campaign} />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
