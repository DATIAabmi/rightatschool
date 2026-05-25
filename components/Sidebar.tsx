"use client";

import { useState } from "react";
import {
  Globe,
  Users,
  UserCircle,
  TrendingUp,
  BookOpen,
  FileText,
  MonitorPlay,
  SlidersHorizontal,
} from "lucide-react";

const navItems = [
  { label: "Ecosystem Insights", icon: Globe },
  { label: "Engaged Users by District", icon: Users },
  { label: "Persona Insights", icon: UserCircle },
  { label: "Leads Insights", icon: TrendingUp },
  { label: "Topic Insights", icon: BookOpen },
  { label: "Content Insights", icon: FileText },
  { label: "Ad Samples", icon: MonitorPlay },
];

export default function Sidebar() {
  const [active, setActive] = useState(0);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 flex flex-col z-10">
      {/* Branding */}
      <div className="px-5 py-6 border-b border-gray-100">
        <p className="text-[10px] font-semibold tracking-widest text-indigo-500 uppercase mb-0.5">
          DATIA K12
        </p>
        <h1 className="text-sm font-bold text-gray-900 leading-tight">
          Analytics Portal
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = active === i;
          return (
            <button
              key={item.label}
              onClick={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon
                size={16}
                className={isActive ? "text-indigo-600" : "text-gray-400"}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left">
          <SlidersHorizontal size={16} className="text-gray-400" />
          Filters
        </button>
      </div>
    </aside>
  );
}
