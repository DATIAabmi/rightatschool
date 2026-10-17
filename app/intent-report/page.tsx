"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, X } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { exportToCsv } from "@/lib/exportCsv";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Persona = { job: string; eng: number; leads: number };
type Topic = { topic: string; score: number; date: string };
type Signal = { date: string; keyword: string; context: string; link: string };

interface District {
  key: string;
  name: string;
  domain: string;
  state: string;
  campaigns: string;
  sbm: boolean;
  eng: number;
  users: number;
  leads: number;
  downloads: number;
  intent: number;
  trend: number;
  last: string;
  personas: Persona[];
  topics: Topic[];
  signals: Signal[];
}

interface Payload {
  districts: unknown[][];
  personas: unknown[][];
  topics: unknown[][];
  signals: unknown[][];
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (v == null ? "" : String(v));
const keyOf = (v: unknown) => str(v).trim().toLowerCase();

function buildDistricts(p: Payload): District[] {
  const group = <T,>(rows: unknown[][], map: (r: unknown[]) => T) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = keyOf(r[0]);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(map(r));
    }
    return m;
  };
  const personas = group(p.personas, (r) => ({ job: str(r[1]), eng: num(r[2]), leads: num(r[3]) }));
  const topics = group(p.topics, (r) => ({ topic: str(r[1]), score: num(r[2]), date: str(r[3]) }));
  const signals = group(p.signals, (r) => ({ date: str(r[1]), keyword: str(r[2]), context: str(r[3]), link: str(r[4]) }));

  return p.districts.map((r) => {
    const key = keyOf(r[0]);
    const tp = topics.get(key) ?? [];
    const sg = signals.get(key) ?? [];
    // Latest activity: the newest of user activity, topic surges and board minutes.
    const last = [str(r[11]), ...tp.map((t) => t.date), ...sg.map((s) => s.date)]
      .filter(Boolean)
      .sort()
      .pop() ?? "";
    return {
      key,
      name: str(r[0]),
      domain: str(r[1]),
      state: str(r[2]),
      campaigns: str(r[3]).split(",").filter(Boolean).sort((a, b) => num(b.slice(1)) - num(a.slice(1))).join(", "),
      sbm: str(r[4]) === "Y",
      eng: num(r[5]),
      users: num(r[6]),
      leads: num(r[7]),
      downloads: num(r[8]),
      intent: Math.round(num(r[9])),
      trend: Math.round(num(r[10])),
      last,
      personas: personas.get(key) ?? [],
      topics: tp,
      signals: sg.sort((a, b) => b.date.localeCompare(a.date)),
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BANDS = [
  { key: "high", label: "High", sub: "80+", min: 80, max: null as number | null, color: "#c2410c" },
  { key: "elevated", label: "Elevated", sub: "50–79", min: 50, max: 79, color: "#d97706" },
  { key: "moderate", label: "Moderate", sub: "25–49", min: 25, max: 49, color: "#2563eb" },
  { key: "early", label: "Early", sub: "Under 25", min: -Infinity, max: 24, color: "#9ca3af" },
];
const bandOf = (i: number) => BANDS.find((b) => i >= b.min && (b.max === null || i <= b.max)) ?? BANDS[3];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d || "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${m}-${dd}-${y.slice(2)}`;
};
const titleCase = (s: string) =>
  s.toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Isd|Cisd|Usd|Ucsd|Esd|Sd)\b/g, (m) => m.toUpperCase());

function statusOf(d: District) {
  if (d.leads >= 2) return { label: "Multiple known leads", cls: "bg-orange-100 text-orange-700" };
  if (d.leads === 1) return { label: "Known lead", cls: "bg-amber-100 text-amber-700" };
  if (d.users > 0) return { label: "Engaged", cls: "bg-blue-50 text-blue-700" };
  return null;
}

type SortKey = "name" | "state" | "intent" | "trend" | "eng" | "users" | "leads" | "last";
const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "name", label: "District" },
  { key: "state", label: "State" },
  { key: "intent", label: "Intent Score", right: true },
  { key: "trend", label: "Trend", right: true },
  { key: "eng", label: "Engagements", right: true },
  { key: "users", label: "Engaged Users", right: true },
  { key: "leads", label: "Known Leads", right: true },
  { key: "last", label: "Latest Activity", right: true },
];
const PAGE = 50;

// ─── Page ─────────────────────────────────────────────────────────────────────

function IntentReportContent() {
  const { campaign, dateStart, dateEnd, resetSignal } = useFilter();

  const [query, setQuery] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [iMin, setIMin] = useState<number | null>(null);
  const [iMax, setIMax] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "intent", dir: -1 });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const hasRange = Boolean(dateStart && dateEnd);

  // The request URL doubles as the load key: loading is true until the result for
  // the current URL arrives, and a slower response for an older URL is ignored.
  const url = useMemo(() => {
    const params = new URLSearchParams();
    const codes = campaign.map((c) => c.split(":")[0].trim());
    if (codes.length) params.set("campaign", codes.join(","));
    if (dateStart && dateEnd) {
      params.set("dateStart", dateStart);
      params.set("dateEnd", dateEnd);
    }
    return `/api/intent-report-data?${params.toString()}`;
  }, [campaign, dateStart, dateEnd]);

  const [result, setResult] = useState<{ url: string; data: District[]; error: string }>({ url: "", data: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        if (!cancelled) setResult({ url, data: buildDistricts(d as Payload), error: "" });
      })
      .catch((err) => { if (!cancelled) setResult({ url, data: [], error: err.message ?? "Failed to load data" }); });
    return () => { cancelled = true; };
  }, [url]);

  const loading = result.url !== url;
  const data = useMemo(() => (loading ? [] : result.data), [loading, result.data]);
  const error = loading ? "" : result.error;

  // Reset Filters in the header clears this page's own filters too.
  const [seenReset, setSeenReset] = useState(resetSignal);
  if (resetSignal !== seenReset) {
    setSeenReset(resetSignal);
    setQuery(""); setStates([]); setIMin(null); setIMax(null); setOpen(new Set());
  }

  // "Show more" starts over at one page whenever the filters change.
  const filterKey = JSON.stringify([url, query, states, iMin, iMax]);
  const [more, setMore] = useState({ key: filterKey, shown: PAGE });
  const shown = more.key === filterKey ? more.shown : PAGE;
  const showMore = () => setMore({ key: filterKey, shown: shown + PAGE });

  const stateOptions = useMemo(() => [...new Set(data.map((d) => d.state).filter(Boolean))].sort(), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((d) => {
      if (q && !d.key.includes(q) && !d.domain.toLowerCase().includes(q)) return false;
      if (states.length && !states.includes(d.state)) return false;
      if (iMin !== null && d.intent < iMin) return false;
      if (iMax !== null && d.intent > iMax) return false;
      return true;
    });
  }, [data, query, states, iMin, iMax]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const x = a[key], y = b[key];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c !== 0 ? c * dir : b.intent - a.intent;
    });
  }, [filtered, sort]);

  const totals = useMemo(() => {
    const sum = (k: "eng" | "users" | "leads" | "intent") => filtered.reduce((t, d) => t + d[k], 0);
    return {
      districts: filtered.length,
      eng: sum("eng"),
      users: sum("users"),
      leads: sum("leads"),
      withLeads: filtered.filter((d) => d.leads > 0).length,
      avg: filtered.length ? sum("intent") / filtered.length : 0,
    };
  }, [filtered]);

  const byState = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((d) => m.set(d.state, (m.get(d.state) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered]);

  const byBand = useMemo(() => BANDS.map((b) => filtered.filter((d) => bandOf(d.intent) === b).length), [filtered]);

  const maxIntent = useMemo(() => Math.max(1, ...data.map((d) => d.intent)), [data]);

  function toggleBand(b: (typeof BANDS)[number]) {
    const min = Number.isFinite(b.min) ? b.min : null;
    const on = iMin === min && iMax === b.max;
    setIMin(on ? null : min);
    setIMax(on ? null : b.max);
  }

  function toggleState(s: string) {
    setStates((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function toggleOpen(key: string) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleExport() {
    exportToCsv(
      "intent-report",
      ["District", "Domain", "State", "Campaign", "Intent Score", "Intent Score Trend", "Engagements", "Engaged Users", "Known Leads", "Total Downloads", "Latest Activity"]
        .map((display_name) => ({ display_name })),
      sorted.map((d) => [d.name, d.domain, d.state, d.campaigns, d.intent, d.trend, d.eng, d.users, d.leads, d.downloads, d.last]),
    );
  }

  const legend =
    "Districts ranked by intent score. Campaign and Date Range apply to every number on this page. | " +
    "With a date range, engagements, engaged users, leads and intent score are recounted from activity in that range; trend compares against the prior campaign.";

  return (
    <div>
      <DashboardHeader legend={legend} />

      {/* Page filters: district search, state, intent score */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg bg-white min-w-[240px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            id="ir-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search district or domain"
            aria-label="Search district or domain"
            className="text-xs text-gray-700 bg-transparent border-none outline-none w-full"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500" aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
        <MultiSelectDropdown label="State" value={states} onChange={setStates} options={stateOptions} minWidth={110} />
        <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg bg-white">
          <span className="text-gray-700 text-xs font-bold uppercase shrink-0">Intent Score:</span>
          <input
            id="ir-min" type="number" min={0} placeholder="Min" aria-label="Minimum intent score"
            value={iMin ?? ""} onChange={(e) => setIMin(e.target.value === "" ? null : Number(e.target.value))}
            className="w-14 text-xs text-gray-700 border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-400"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            id="ir-max" type="number" min={0} placeholder="Max" aria-label="Maximum intent score"
            value={iMax ?? ""} onChange={(e) => setIMax(e.target.value === "" ? null : Number(e.target.value))}
            className="w-14 text-xs text-gray-700 border border-gray-200 rounded px-1.5 py-1 outline-none focus:border-blue-400"
          />
          {BANDS.slice(0, 3).map((b) => {
            const on = iMin === b.min && iMax === b.max;
            return (
              <button
                key={b.key} type="button" onClick={() => toggleBand(b)} aria-pressed={on} title={`Intent ${b.sub}`}
                className={`px-2 py-1 text-xs font-semibold rounded border transition-colors ${on ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {b.label} <span className={on ? "text-gray-300" : "text-gray-400"}>{b.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 bg-white border border-gray-200 rounded-xl shadow-sm divide-x divide-gray-100 mb-4">
        {[
          [fmt(totals.districts), "Districts"],
          [fmt(totals.eng), "Engagements"],
          [fmt(totals.users), "Engaged Users"],
          [fmt(totals.leads), `Known Leads · ${fmt(totals.withLeads)} districts`],
          [fmt(totals.avg), "Average Intent Score"],
        ].map(([v, k]) => (
          <div key={k} className="px-5 py-4 text-center">
            <div className="text-3xl font-bold text-blue-700 tabular-nums">{loading ? "–" : v}</div>
            <div className="text-xs text-gray-500 mt-1">{k}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-gray-900">Districts by State</h2>
          <p className="text-xs text-gray-500 mb-3">Top 12 states in the current view. Click a bar to filter to that state.</p>
          <div className="grid gap-1.5">
            {byState.map(([s, n]) => {
              const on = states.includes(s);
              return (
                <button
                  key={s} type="button" onClick={() => toggleState(s)} aria-pressed={on}
                  className="grid items-center gap-2 text-left group" style={{ gridTemplateColumns: "34px 1fr 56px" }}
                >
                  <span className={`text-xs font-bold ${on ? "text-blue-700" : "text-gray-700"}`}>{s}</span>
                  <span className="h-4 bg-gray-100 rounded overflow-hidden">
                    <span className="block h-full bg-blue-600 rounded group-hover:opacity-80" style={{ width: `${(n / byState[0][1]) * 100}%` }} />
                  </span>
                  <span className="text-xs text-gray-500 text-right tabular-nums">{fmt(n)}</span>
                </button>
              );
            })}
            {!loading && byState.length === 0 && <p className="text-xs text-gray-400">No districts match these filters.</p>}
          </div>
        </section>
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-gray-900">Intent Score Distribution</h2>
          <p className="text-xs text-gray-500 mb-3">Districts in the current view, grouped by intent band.</p>
          <div className="grid gap-2.5">
            {BANDS.map((b, i) => (
              <div key={b.key} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "130px 1fr 56px" }}>
                <span><b className="text-gray-800">{b.label}</b> <span className="text-gray-400">{b.sub}</span></span>
                <span className="h-4 bg-gray-100 rounded overflow-hidden">
                  <span className="block h-full rounded" style={{ width: `${(byBand[i] / Math.max(1, ...byBand)) * 100}%`, background: b.color }} />
                </span>
                <span className="text-gray-500 text-right tabular-nums">{fmt(byBand[i])}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Ranked table */}
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm tracking-wide uppercase">Intent Report</span>
          {!loading && <span className="text-gray-400 text-xs">{fmt(filtered.length)} of {fmt(data.length)} districts</span>}
        </div>
        {sorted.length > 0 && (
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors">
            <Download size={13} /> Export
          </button>
        )}
      </div>
      <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-x-auto">
        {loading && <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading districts…</div>}
        {!loading && error && <div className="h-64 flex items-center justify-center text-sm text-red-500">{error}</div>}
        {!loading && !error && (
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th key={c.key} aria-sort={active ? (sort.dir < 0 ? "descending" : "ascending") : "none"}
                      className={`px-3 py-3 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap ${c.right ? "text-right" : "text-left"}`}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 hover:opacity-70"
                        onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === 1 ? -1 : 1) : c.key === "name" || c.key === "state" ? 1 : -1 })}
                      >
                        {c.label}
                        {active ? (sort.dir < 0 ? <ArrowDown size={10} /> : <ArrowUp size={10} />) : <ArrowUpDown size={10} className="opacity-30" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-gray-400">No districts match these filters. Try widening the date range or lowering the minimum intent score.</td></tr>
              )}
              {sorted.slice(0, shown).map((d) => {
                const isOpen = open.has(d.key);
                const st = statusOf(d);
                const band = bandOf(d.intent);
                return (
                  <Fragment key={d.key}>
                    <tr
                      tabIndex={0}
                      aria-expanded={isOpen}
                      onClick={() => toggleOpen(d.key)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOpen(d.key); } }}
                      className={`cursor-pointer border-b border-gray-100 text-sm ${isOpen ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-gray-900">
                          {titleCase(d.name)}
                          {st && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide align-middle ${st.cls}`}>{st.label}</span>}
                        </div>
                        <div className="text-xs text-gray-500">{d.domain}{d.campaigns && ` · ${d.campaigns}`}</div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{d.state}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="w-14 h-1.5 bg-gray-100 rounded overflow-hidden">
                            <span className="block h-full" style={{ width: `${Math.max(0, (d.intent / maxIntent) * 100)}%`, background: band.color }} />
                          </span>
                          <b className="tabular-nums w-9 text-right">{fmt(d.intent)}</b>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {d.trend > 0 ? <span className="text-green-700">▲ {fmt(d.trend)}</span>
                          : d.trend < 0 ? <span className="text-red-600">▼ {fmt(Math.abs(d.trend))}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(d.eng)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(d.users)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.leads ? <b>{fmt(d.leads)}</b> : "0"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmtDate(d.last)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-gray-200">
                        <td colSpan={8} className="p-0 bg-gray-50"><AccountCard d={d} hasRange={hasRange} /></td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !error && sorted.length > shown && (
          <div className="flex justify-center p-4">
            <button type="button" onClick={showMore}
              className="px-4 py-2 text-xs font-semibold text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg bg-white">
              Show {Math.min(PAGE, sorted.length - shown)} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({ d, hasRange }: { d: District; hasRange: boolean }) {
  const st = statusOf(d);
  const personas = d.personas.filter((p) => p.eng > 0).sort((a, b) => b.eng - a.eng || b.leads - a.leads);
  const leadJobs = d.personas.filter((p) => p.leads > 0).sort((a, b) => b.leads - a.leads);
  const leadJobTotal = leadJobs.reduce((t, p) => t + p.leads, 0);
  const topics = [...d.topics].sort((a, b) => b.score - a.score);
  const box = "bg-white border border-gray-200 rounded-lg p-4 min-w-0";
  const h4 = "text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2";

  return (
    <div className="p-5 grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold text-blue-700">{titleCase(d.name)}</h3>
        <span className="text-xs text-gray-500">
          {d.domain} · {d.state} · {d.campaigns}{d.sbm && " · Board minutes tracked"}
          {st && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</span>}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-gray-200 rounded-lg divide-x divide-gray-100">
        {[[d.intent, "Intent Score"], [d.eng, "Engagements"], [d.users, "Engaged Users"], [d.leads, "Known Leads"]].map(([v, k]) => (
          <div key={k} className="py-3 text-center">
            <div className="text-2xl font-bold text-blue-700 tabular-nums">{fmt(Number(v))}</div>
            <div className="text-xs text-gray-500">{k}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={box}>
          <h4 className={h4}>Persona Activity</h4>
          {personas.length ? (
            <div className="grid gap-x-4 gap-y-1 text-sm" style={{ gridTemplateColumns: "1fr auto auto" }}>
              <span className="text-[11px] font-semibold text-gray-400">Job function</span>
              <span className="text-[11px] font-semibold text-gray-400 text-right">Eng.</span>
              <span className="text-[11px] font-semibold text-gray-400 text-right">Leads</span>
              {personas.slice(0, 10).map((p) => (
                <Fragment key={p.job}>
                  <span className="text-gray-800">{titleCase(p.job)}</span>
                  <span className="text-right tabular-nums">{fmt(p.eng)}</span>
                  <span className="text-right tabular-nums">{p.leads}</span>
                </Fragment>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No persona engagement{hasRange ? " in this date range" : ""}.</p>}
          {personas.length > 10 && <p className="text-xs text-gray-400 mt-2">+ {personas.length - 10} more job functions</p>}
        </div>
        <div className={box}>
          <h4 className={h4}>Known Leads by Job Function</h4>
          {leadJobs.length > 0 && (
            <div className="grid gap-x-4 gap-y-1 text-sm" style={{ gridTemplateColumns: "1fr auto" }}>
              <span className="text-[11px] font-semibold text-gray-400">Job function</span>
              <span className="text-[11px] font-semibold text-gray-400 text-right">Leads</span>
              {leadJobs.map((p) => (
                <Fragment key={p.job}>
                  <span className="text-gray-800">{titleCase(p.job)}</span>
                  <span className="text-right tabular-nums">{p.leads}</span>
                </Fragment>
              ))}
            </div>
          )}
          {d.leads > leadJobTotal && (
            <p className="text-xs text-gray-500 mt-2">{d.leads - leadJobTotal} known lead{d.leads - leadJobTotal > 1 ? "s" : ""} without a job function on record.</p>
          )}
          {d.leads === 0 && <p className="text-sm text-gray-400">No known leads yet.</p>}
        </div>
      </div>

      <div className={box}>
        <h4 className={h4}>Topic Surges{hasRange ? " in Date Range" : ""}</h4>
        {topics.length ? (
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <span key={t.topic} className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50">
                {t.topic} <span className="text-gray-400 tabular-nums">{fmt(t.score)} · {fmtDate(t.date)}</span>
              </span>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No topic surges{hasRange ? " in this date range" : ""}.</p>}
      </div>

      <div className={box}>
        <h4 className={h4}>School Board Minutes / Account Intelligence</h4>
        {d.signals.length ? (
          <div className="grid gap-2">
            {d.signals.map((s, i) => (
              <div key={`${s.link}-${i}`} className="border border-gray-200 rounded-md px-3 py-2">
                <div className="flex flex-wrap gap-3 text-[11px] font-bold text-gray-500">
                  <span className="tabular-nums">{fmtDate(s.date)}</span>
                  {s.keyword && <span>Keyword: {s.keyword}</span>}
                </div>
                {s.context && <p className="text-sm text-gray-800 mt-1">{s.context}</p>}
                {/^https?:\/\//.test(s.link) && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">
                    Open source ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No board-minute highlights{hasRange ? " in this date range" : ""}.</p>}
      </div>
    </div>
  );
}

export default function Page() {
  return <IntentReportContent />;
}
