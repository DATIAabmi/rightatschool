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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      {/* Logo + Title row */}
      <div className="flex items-center justify-between">
        {/* Left: Right At School logo */}
        <div className="flex-shrink-0 w-44">
          <Image
            src="/right-at-school-logo.png"
            alt="Right At School"
            width={924}
            height={617}
            style={{ height: "132px", width: "auto" }}
            className="object-contain"
          />
        </div>

        {/* Center: Campaign title */}
        <div className="text-center flex-1 px-8">
          <h1 className="font-bold text-gray-900 tracking-tight leading-none" style={{ fontFamily: "'Lato', sans-serif", fontSize: "20px" }}>
            ABMi Always On
          </h1>
          <p className="text-sm text-gray-700 mt-1 font-medium">
            {subtitle}
          </p>
          <div className="w-14 h-0.5 bg-red-500 mx-auto mt-3 rounded-full" />
        </div>

        {/* Right: DATIA K12 logo */}
        <div className="flex-shrink-0 w-44 flex justify-end">
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
