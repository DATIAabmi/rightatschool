"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

// ─── Live-search combobox (district / domain) ─────────────────────────────────

function SearchDropdown({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: "district" | "domain" | "state";
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

  const fetchOptions = useCallback(
    (q: string) => {
      setLoading(true);
      fetch(`/api/filter-search?field=${field}&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          setOptions(d.values ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [field]
  );

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const target = options[0] ?? query.trim();
    if (!target) return;
    onChange(target);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={handleOpen}
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
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
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
              onKeyDown={handleKeyDown}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">
                Searching…
              </p>
            )}
            {!loading && options.length === 0 && query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">
                No results for &quot;{query}&quot;
              </p>
            )}
            {!loading && options.length === 0 && !query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">
                Type to search
              </p>
            )}
            {value && (
              <button
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
              >
                Clear filter
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${
                  value === opt
                    ? "text-blue-600 font-semibold bg-blue-50"
                    : "text-gray-700"
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
  return (
    <div
      className="flex items-stretch bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-3"
      style={{ height: 48 }}
    >
      <div className="flex items-center px-5 shrink-0">
        <span className="font-bold text-sm tracking-wide text-gray-900 uppercase">
          District Engagement
        </span>
      </div>
      <SearchDropdown
        label="District Domain"
        field="domain"
        value={domain}
        onChange={onDomainChange}
      />
      <SearchDropdown
        label="District"
        field="district"
        value={district}
        onChange={onDistrictChange}
      />
      <SearchDropdown
        label="State"
        field="state"
        value={state}
        onChange={onStateChange}
      />
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

type Col = { display_name: string; base_type: string };
type Row = (string | number | null)[];

const NUMBER_TYPES = new Set([
  "type/Integer",
  "type/BigInteger",
  "type/Float",
  "type/Decimal",
  "type/Number",
]);

function DataTable({
  cols,
  rows,
  onDistrictClick,
}: {
  cols: Col[];
  rows: Row[];
  onDistrictClick: (district: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No results
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th
              className="px-3 py-3 text-right font-semibold text-gray-400 w-10 shrink-0"
              style={{ color: "#509EE3" }}
            >
              #
            </th>
            {cols.map((col) => (
              <th
                key={col.display_name}
                className={`px-4 py-3 font-semibold whitespace-nowrap ${
                  NUMBER_TYPES.has(col.base_type) ? "text-right" : "text-left"
                }`}
                style={{ color: "#509EE3" }}
              >
                {col.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2.5 text-right text-gray-400 text-xs">
                {i + 1}
              </td>
              {row.map((cell, j) => {
                const isNum = NUMBER_TYPES.has(cols[j]?.base_type);
                const display =
                  cell === null || cell === undefined ? "" : String(cell);
                const isDistrict = j === 0;
                return (
                  <td
                    key={j}
                    className={`px-4 py-2.5 ${
                      isNum ? "text-right tabular-nums" : "text-left"
                    } text-gray-800`}
                  >
                    {isDistrict ? (
                      <button
                        onClick={() => onDistrictClick(display)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-left"
                      >
                        {display}
                      </button>
                    ) : (
                      display
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();
  const [district, setDistrict] = useState("");
  const [domain, setDomain] = useState("");
  const [state, setState] = useState("");

  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (district) params.set("district", district);
    if (domain) params.set("domain", domain);
    if (state) params.set("state", state);

    fetch(`/api/q405-data?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCols(d.cols);
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load data");
        setLoading(false);
      });
  }, [district, domain, state]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "16rem",
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f9fafb",
        zIndex: 1,
      }}
    >
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
        <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 mb-3">
          <p><span className="font-bold text-gray-700">SBM</span> - School Board Minutes. The SBM Link directs to the school board minutes document.</p>
          <p><span className="font-bold text-gray-700">Topic</span> is the intent signals based on content consumption. See Topic Insights dashboard.</p>
          <p><span className="font-bold text-gray-700">Engagements</span> are the number of clicks on your ads, email opens and lead downloads.</p>
          <p><span className="font-bold text-gray-700">Intent Score</span> is a numerical value that indicates a lead/district&apos;s likelihood to be in market derived from district data and total engagement on and off the DATIA K12 channels.</p>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "0 24px 24px",
        }}
      >
        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && (
          <DataTable
            cols={cols}
            rows={rows}
            onDistrictClick={(d) =>
              router.push(
                `/school-board-minutes?district=${encodeURIComponent(d)}`
              )
            }
          />
        )}

      </div>
    </div>
  );
}
