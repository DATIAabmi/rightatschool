"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { StaticQuestion } from "@metabase/embedding-sdk-react";
import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import DashboardHeader from "@/components/DashboardHeader";

// ─── Live-search combobox (district / domain) ─────────────────────────────────

function SearchDropdown({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "district" | "domain";
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch options whenever query changes
  const fetchOptions = useCallback((q: string) => {
    setLoading(true);
    fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => { setOptions(d.values ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [field]);

  function handleOpen() {
    setOpen((o) => !o);
    setQuery("");
    setOptions([]);
    setTimeout(() => {
      inputRef.current?.focus();
      fetchOptions("");
    }, 50);
  }

  function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(q), 300);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-l border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="flex-1 truncate text-sm text-gray-500">
          {value ? <span className="text-gray-900 font-medium">{value}</span> : label}
        </span>
        {value ? (
          <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(""); }} />
        ) : (
          <ChevronDown size={13} className="text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</p>
            )}
            {!loading && options.length === 0 && query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">No results for "{query}"</p>
            )}
            {!loading && options.length === 0 && !query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">Type to search</p>
            )}
            {value && (
              <button
                onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
              >
                Clear filter
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${
                  value === opt ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pre-loaded select (State — only 51 values) ───────────────────────────────

function StateDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/filter-search?field=state&q=")
      .then((r) => r.json())
      .then((d) => setStates(d.values ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-l border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="flex-1 truncate text-sm text-gray-500">
          {value ? <span className="text-gray-900 font-medium">{value}</span> : "State"}
        </span>
        {value ? (
          <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(""); }} />
        ) : (
          <ChevronDown size={13} className="text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {value && (
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
              >
                Clear filter
              </button>
            )}
            {states.map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  value === s ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function DistrictFilterBar({
  district, domain, state,
  onDistrictChange, onDomainChange, onStateChange,
}: {
  district: string; domain: string; state: string;
  onDistrictChange: (v: string) => void;
  onDomainChange: (v: string) => void;
  onStateChange: (v: string) => void;
}) {
  return (
    <div className="flex items-stretch bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-3" style={{ height: 48 }}>
      <div className="flex items-center px-5 shrink-0">
        <span className="font-bold text-sm tracking-wide text-gray-900 uppercase">
          District Engagement
        </span>
      </div>
      <SearchDropdown label="District Domain" field="domain" value={domain} onChange={onDomainChange} />
      <SearchDropdown label="District" field="district" value={district} onChange={onDistrictChange} />
      <StateDropdown value={state} onChange={onStateChange} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [district, setDistrict] = useState("");
  const [domain, setDomain] = useState("");
  const [state, setState] = useState("");

  // Build SQL params — only include non-empty values so Metabase omits
  // the optional [[ ]] blocks for unset filters instead of IN ('').
  const sqlParams: Record<string, string> = {};
  if (district) sqlParams["District"] = district;
  if (domain)   sqlParams["District_Domain"] = domain;
  if (state)    sqlParams["State"] = state;

  // Stringify key forces StaticQuestion to remount when any filter changes.
  const filterKey = JSON.stringify(sqlParams);

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
          <StaticQuestion
            key={filterKey}
            questionId={405}
            initialSqlParameters={sqlParams}
            height="100%"
          />
        </div>
      </div>
    </MetabaseProviderWrapper>
  );
}
