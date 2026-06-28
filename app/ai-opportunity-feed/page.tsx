"use client";

import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import { Sparkles } from "lucide-react";

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
        <div style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
          <DashboardHeader />
        </div>
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          color: "#9ca3af",
        }}>
          <Sparkles size={36} className="text-indigo-300" />
          <p style={{ fontSize: 15, fontWeight: 500 }}>AI Opportunity Feed</p>
          <p style={{ fontSize: 13 }}>Share the Metabase question URL to connect data here.</p>
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
