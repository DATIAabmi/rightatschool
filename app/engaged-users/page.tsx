"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";
import QuestionEmbed from "@/components/QuestionEmbed";

// ─── Searchable combobox ──────────────────────────────────────────────────────

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function toggle() {
    setOpen((o) => !o);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* Trigger */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-l border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="flex-1 truncate text-sm text-gray-500">
          {value ? (
            <span className="text-gray-900 font-medium">{value}</span>
          ) : (
            label
          )}
        </span>
        {value ? (
          <X
            size={13}
            className="text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <ChevronDown size={13} className="text-gray-400 shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${!value ? "text-blue-600 font-semibold" : "text-gray-500"}`}
            >
              All {label}s
            </button>
            {filtered.slice(0, 200).map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${value === opt ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}
              >
                {opt}
              </button>
            ))}
            {filtered.length > 200 && (
              <p className="px-4 py-2 text-xs text-gray-400">
                {filtered.length - 200} more — refine your search
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function DistrictFilterBar({
  district,
  domain,
  state,
  onDistrictChange,
  onDomainChange,
  onStateChange,
}: {
  district: string;
  domain: string;
  state: string;
  onDistrictChange: (v: string) => void;
  onDomainChange: (v: string) => void;
  onStateChange: (v: string) => void;
}) {
  const [options, setOptions] = useState<{
    districts: string[];
    domains: string[];
    states: string[];
  }>({ districts: [], domains: [], states: [] });

  useEffect(() => {
    fetch("/api/filter-values")
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-stretch bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-3" style={{ height: 48 }}>
      {/* Title */}
      <div className="flex items-center px-5 shrink-0">
        <span className="font-bold text-sm tracking-wide text-gray-900 uppercase">
          District Engagement
        </span>
      </div>

      {/* Filters */}
      <FilterDropdown
        label="District Domain"
        value={domain}
        options={options.domains}
        onChange={onDomainChange}
      />
      <FilterDropdown
        label="District"
        value={district}
        options={options.districts}
        onChange={onDistrictChange}
      />
      <FilterDropdown
        label="State"
        value={state}
        options={options.states}
        onChange={onStateChange}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [district, setDistrict] = useState("");
  const [domain, setDomain] = useState("");
  const [state, setState] = useState("");

  const staticParams: Record<string, string> = {};
  if (domain)   staticParams["District_Domain"] = domain;
  if (state)    staticParams["State"] = state;

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
        <div style={{ flexShrink: 0, padding: "16px 24px 0" }}>
          <DashboardHeader />
          <DistrictFilterBar
            district={district}
            domain={domain}
            state={state}
            onDistrictChange={setDistrict}
            onDomainChange={setDomain}
            onStateChange={setState}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <QuestionEmbed
            questionId={405}
            campaignSqlKey="ABM_Campaign"
            districtSqlKey="District"
            staticParams={staticParams}
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
