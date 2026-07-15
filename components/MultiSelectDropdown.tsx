"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";

interface BaseProps {
  label: string;
  value: string[];
  onChange: (values: string[]) => void;
  minWidth?: number;
}

interface StaticProps extends BaseProps {
  /** Fixed, fully-known option list (e.g. campaigns). */
  options: string[];
  search?: undefined;
}

interface SearchProps extends BaseProps {
  /** Async live-search, e.g. district/state/domain/job function lookups. */
  search: (query: string) => Promise<string[]>;
  options?: undefined;
}

type Props = StaticProps | SearchProps;

function summarize(value: string[]): string {
  if (value.length === 0) return "All";
  if (value.length === 1) return value[0];
  return `${value.length} selected`;
}

export default function MultiSelectDropdown(props: Props) {
  const { label, value, onChange, minWidth = 180 } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>(props.options ?? []);
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

  const runSearch = useCallback((q: string) => {
    if (!props.search) return;
    setLoading(true);
    props.search(q).then((vals) => { setOptions(vals); setLoading(false); }).catch(() => setLoading(false));
  }, [props.search]);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    setQuery("");
    if (next && props.search) {
      setTimeout(() => { inputRef.current?.focus(); }, 50);
      runSearch("");
    }
  }

  function handleSearchInput(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  }

  function toggle(opt: string) {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  }

  const displayOptions = props.options ?? options;
  const allShownSelected = displayOptions.length > 0 && displayOptions.every((opt) => value.includes(opt));

  function toggleSelectAllShown() {
    if (allShownSelected) {
      onChange(value.filter((v) => !displayOptions.includes(v)));
    } else {
      onChange([...new Set([...value, ...displayOptions])]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 transition-colors"
        style={{ minWidth }}
      >
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider shrink-0">{label}:</span>
        <span className="flex-1 text-left truncate text-xs">
          {value.length > 0
            ? <span className="text-blue-600 font-medium">{summarize(value)}</span>
            : <span className="text-gray-400">All</span>}
        </span>
        {value.length > 0 ? (
          <X size={13} className="text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange([]); }} />
        ) : (
          <ChevronDown size={13} className="text-gray-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {props.search && (
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
          )}

          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 max-h-24 overflow-y-auto">
              {value.map((v) => (
                <span key={v} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                  <span className="truncate max-w-[160px]">{v}</span>
                  <button onClick={() => toggle(v)} className="hover:text-blue-900">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => onChange([])}
                className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {loading && <p className="px-4 py-3 text-xs text-gray-400 text-center">Searching…</p>}
            {!loading && displayOptions.length === 0 && query && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">No results for &quot;{query}&quot;</p>
            )}
            {!loading && displayOptions.length === 0 && !query && props.search && (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">Type to search</p>
            )}
            {!loading && displayOptions.length > 0 && (props.search ? query : true) && (
              <button
                onClick={toggleSelectAllShown}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-b border-gray-100"
              >
                {allShownSelected ? "Deselect all shown" : `Select all ${displayOptions.length} shown`}
              </button>
            )}
            {!loading && displayOptions.map((opt) => {
              const checked = value.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm hover:bg-gray-50 truncate ${checked ? "text-blue-600 font-semibold bg-blue-50/60" : "text-gray-700"}`}
                >
                  <span className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
