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
      <div className="relative flex items-center">
        {/* Left: Right At School logo */}
        <div className="flex-shrink-0 flex items-center gap-6">
          <Image
            src="/right-at-school-logo.png"
            alt="Right At School"
            width={924}
            height={617}
            style={{ height: "110px", width: "auto" }}
            className="object-contain"
          />
          {/* Vertical divider */}
          <div className="self-stretch w-px bg-gray-200 shrink-0" />
        </div>

        {/* Center: absolutely centered in the full card */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
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
