"use client";

import Image from "next/image";
import { useFilter } from "@/components/FilterContext";
import { campaignDateRange } from "@/lib/campaigns";

export default function DashboardHeader({ legend }: { legend?: string }) {
  const { campaign } = useFilter();

  const subtitle = campaign
    ? campaignDateRange(campaign)
    : "All Campaigns";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-5 mb-4">
      <div className="flex items-center gap-0">
        {/* Left: Right At School logo */}
        <div className="flex-shrink-0 pr-8">
          <Image
            src="/right-at-school-logo.png"
            alt="Right At School"
            width={924}
            height={617}
            style={{ height: "88px", width: "auto" }}
            className="object-contain"
          />
        </div>

        {/* Vertical divider */}
        <div className="self-stretch w-px bg-gray-200 mx-0 shrink-0" />

        {/* Center: Campaign title */}
        <div className="flex-1 pl-10">
          <h1
            className="font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: "38px", letterSpacing: "-0.5px" }}
          >
            ABMi Always On
          </h1>
          <p className="mt-1 font-medium" style={{ fontSize: "15px", color: "#6b8cba" }}>
            {subtitle}
          </p>
          <div className="h-0.5 bg-red-500 mt-2 rounded-full" style={{ width: 56 }} />
        </div>

        {/* Right: DATIA K12 logo */}
        <div className="flex-shrink-0 pl-8">
          <Image
            src="/datia-k12-logo.png"
            alt="DATIA K12"
            width={150}
            height={44}
            className="object-contain"
          />
        </div>
      </div>

      {legend && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-0.5" style={{ fontFamily: "'Lato', sans-serif" }}>
          {legend.split(" | ").map((line, i) => (
            <p key={i} className="text-xs text-gray-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
