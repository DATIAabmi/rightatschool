"use client";

import { useState } from "react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import EcosystemFunnel from "@/components/EcosystemFunnel";

export default function EcosystemFunnelPage() {
  const [campaign, setCampaign] = useState<string | null>(null);
  return (
    <MetabaseProviderWrapper>
      <EcosystemFunnel campaign={campaign} onCampaignChange={setCampaign} />
    </MetabaseProviderWrapper>
  );
}
