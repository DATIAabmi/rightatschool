"use client";

import Image from "next/image";
import { Clock, Calendar, Activity, CalendarSearch, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFilter } from "./FilterContext";

const CAMPAIGN_PERIODS: Record<string, string> = {
  "C6: April - May 2026": "Apr 2026 – May 2026",
  "C5: Nov 2025 - May 2026": "Nov 2025 – May 2026",
  "C4: Aug - Sept 2025": "Aug 2025 – Sep 2025",
  "C3: June 2025": "Jun 2025",
  "C2: May - June 2025": "May 2025 – Jun 2025",
  "C1: April - May 2025": "Apr 2025 – May 2025",
};

export default function DashboardHeader() {
  const [lastUpdated, setLastUpdated] = useState("");
  const { dateStart, dateEnd, setDateStart, setDateEnd, campaign, setCampaign } = useFilter();

  useEffect(() => {
    const now = new Date();
    const date = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    setLastUpdated(`${date} • ${time}`);
  }, []);

  const clearDates = () => {
    setDateStart("");
    setDateEnd("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-4">
      {/* Logo + Title row */}
      <div className="flex items-center justify-between mb-8">
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
          <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">
            ABMi Always On
          </h1>
          <p className="text-sm text-gray-400 mt-2 tracking-wide">
            Executive ABM Intelligence Dashboard
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

      {/* Info cards row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Last Updated */}
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">
              Last Updated
            </p>
            <p className="text-sm font-bold text-gray-800 leading-tight">
              {lastUpdated || "Loading…"}
            </p>
          </div>
        </div>

        {/* ABMi Campaign selector */}
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="w-11 h-11 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar size={20} className="text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">
              ABMi Campaign
            </p>
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="text-sm font-bold text-gray-800 bg-transparent border-none outline-none w-full cursor-pointer truncate"
            >
              <option value="">All Campaigns</option>
              {Object.keys(CAMPAIGN_PERIODS).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Program Status */}
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="w-11 h-11 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
            <Activity size={20} className="text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">
              Program Status
            </p>
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Active
            </span>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="w-11 h-11 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <CalendarSearch size={20} className="text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Date Filter
              </p>
              {(dateStart || dateEnd) && (
                <button
                  onClick={clearDates}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear dates"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 w-full text-gray-700"
                placeholder="Start date"
              />
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 w-full text-gray-700"
                placeholder="End date"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
