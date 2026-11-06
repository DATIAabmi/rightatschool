"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Filter, Landmark, Loader2, MousePointerClick, Printer, Target, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFilter } from "@/components/FilterContext";
import { fmtDate } from "@/lib/fmtDate";
import { exportToCsv } from "@/lib/exportCsv";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistrictRow {
  District: string;
  Domain: string;
  State: string;
  Campaign: string;
  Intel: string;
  AccountIntel: string;
  TopicInsights: string;
  Engagements: number;
  EngagedUsers: number;
  Leads: number;
  IntentScore: number;
  Trend: number;
  LastActivity: string;
}

interface PersonaRow {
  JobFunction: string;
  Users: number;
  Engagements: number;
  Leads: number;
}

interface SignalRow {
  Date: string;
  Category: string;
  Keywords: string;
  Source: string;
  Link: string;
  Analysis: string;
  SourceText: string;
  Strength: number;
}

interface TopicRow {
  Topic: string;
  Score: number;
  Date: string;
}

interface CardData {
  persona: PersonaRow[];
  signals: SignalRow[];
  topics: TopicRow[];
}

type SortKey = keyof DistrictRow;
type SortDir = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function intentBand(score: number): { label: string; color: string; soft: string } {
  if (score >= 80) return { label: "High",     color: "var(--hot)",  soft: "var(--hot-soft)"  };
  if (score >= 50) return { label: "Elevated", color: "var(--warm)", soft: "var(--warm-soft)" };
  if (score >= 25) return { label: "Moderate", color: "var(--act)",  soft: "var(--accent-soft)" };
  if (score >= 1)  return { label: "Early",    color: "var(--low)",  soft: "var(--sunk)"       };
  return                  { label: "",          color: "var(--low)",  soft: "var(--sunk)"       };
}

// For SBM rows the signals sheet stores `source = "Minutes"` literally, so the
// link text would just read "Minutes" for every row — unhelpful. On Extron the
// source column carries a publication name ("Government Technology"), giving
// naturally descriptive link text. Here we fall back to the URL hostname for
// generic source values so each link tells you where it goes.
function signalLinkLabel(s: { Source: string; Link: string }): string {
  const src = (s.Source || "").trim();
  const generic = /^(minutes?|website|link|source|news|article|rfp|bid)$/i.test(src);
  if (!generic && src) return src;
  try {
    const host = new URL(s.Link).hostname.replace(/^www\./, "");
    if (host) return host;
  } catch { /* URL parse failed — fall through to source */ }
  return src || "Website";
}

function fmt(n: number): string {
  return n.toLocaleString();
}

// ─── Campaign Popover ─────────────────────────────────────────────────────────

function CampaignPopover({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  const label =
    selected.length === 0
      ? "All campaigns"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} campaigns`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13,
          border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)",
          color: selected.length ? "var(--ink)" : "var(--muted)", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ fontFamily: "var(--f-body)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 220, padding: "8px 0",
        }}>
          <div style={{ padding: "0 12px 6px", borderBottom: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              All campaigns
            </button>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {options.map((opt) => (
              <label
                key={opt}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ color: "var(--ink)", fontFamily: "var(--f-body)" }}>{opt}</span>
              </label>
            ))}
          </div>
          <div style={{ padding: "6px 12px 0", borderTop: "1px solid var(--line)", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: "100%", padding: "6px 0", fontSize: 13, fontWeight: 600,
                background: "var(--accent)", color: "var(--accent-ink)", border: "none",
                borderRadius: 6, cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── State Popover ────────────────────────────────────────────────────────────

function StatePopover({
  options,
  selected,
  onChange,
}: {
  options: { state: string; count: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = options.filter((o) => o.state.toLowerCase().includes(search.toLowerCase()));

  const toggle = (st: string) => {
    onChange(selected.includes(st) ? selected.filter((s) => s !== st) : [...selected, st]);
  };

  const label =
    selected.length === 0
      ? "All states"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} states`;

  // Sort alphabetically for the 2-col grid
  const sortedFiltered = [...filtered].sort((a, b) => a.state.localeCompare(b.state));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13,
          border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)",
          color: selected.length ? "var(--ink)" : "var(--muted)", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ fontFamily: "var(--f-body)" }}>{label}</span>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.14)", minWidth: 490, padding: "12px 14px 10px",
        }}>
          <input
            type="search"
            placeholder="Find a state"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 10px", fontSize: 13, marginBottom: 10,
              border: "1px solid var(--line)", borderRadius: 7, boxSizing: "border-box",
              background: "var(--sunk)", color: "var(--ink)", fontFamily: "var(--f-body)",
              outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.border = "1.5px solid var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.border = "1px solid var(--line)"; }}
          />
          <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {sortedFiltered.map(({ state, count }) => (
              <label
                key={state}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", cursor: "pointer", borderRadius: 5, userSelect: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sunk)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(state)}
                  onChange={() => toggle(state)}
                  style={{ width: 15, height: 15, margin: 0, flexShrink: 0, accentColor: "var(--accent)" }}
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--f-body)" }}>{state}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--f-body)" }}>{count}</span>
              </label>
            ))}
            {sortedFiltered.length === 0 && (
              <div style={{ gridColumn: "span 2", padding: "8px 4px", fontSize: 13, color: "var(--muted)", fontFamily: "var(--f-body)" }}>No states match.</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 8, borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--f-body)" }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--f-body)" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded row card ────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",
};

const SMALL_WORDS = new Set(["of","the","and","for","at","in","on","to","by","a","an"]);
function titleCaseName(raw: string): string {
  const cleaned = raw.replace(/,\s*[A-Z]{2}\s*$/i, "");
  return cleaned
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part, i) => {
      if (/^\s+$/.test(part) || part === "-") return part;
      if (i !== 0 && SMALL_WORDS.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function pluralLabel(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function StatTile({ icon: Icon, value, label }: { icon: LucideIcon; value: number | string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", minWidth: 0 }}>
      <Icon size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>{value}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, fontFamily: "var(--f-body)" }}>{label}</div>
      </div>
    </div>
  );
}

function ExpandedCard({ district, row, campaigns }: { district: string; row: DistrictRow; campaigns: string[] }) {
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ district });
    if (campaigns.length) params.set("campaign", campaigns.join(","));
    fetch(`/api/intent-card-data?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [district, campaigns]);

  const titleName = titleCaseName(row.District);
  const stateFull = STATE_NAMES[row.State] ?? row.State;
  const title = stateFull ? `${titleName}, ${stateFull}` : titleName;

  return (
    <div style={{ padding: 20, background: "var(--bg)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Landmark size={28} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <h3 style={{ margin: 0, fontFamily: "var(--f-display)", fontSize: 24, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
            {title}
          </h3>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "var(--f-body)", alignItems: "center" }}>
            {row.Domain && <span>{row.Domain}</span>}
            {row.State && <><span style={{ color: "var(--low)" }}>|</span><span>{row.State}</span></>}
            {row.Campaign && <><span style={{ color: "var(--low)" }}>|</span><span>{row.Campaign}</span></>}
          </div>
        </div>
      </div>

      {/* 4-stat grid — icon + value + label */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <StatTile icon={Target}             value={fmt(row.IntentScore)}  label="Intent Score" />
        <StatTile icon={MousePointerClick}  value={fmt(row.Engagements)}  label={pluralLabel(row.Engagements, "Engagement", "Engagements")} />
        <StatTile icon={Users}              value={fmt(row.EngagedUsers)} label={pluralLabel(row.EngagedUsers, "Engaged User", "Engaged Users")} />
        <StatTile icon={Filter}             value={String(row.Leads)}     label="Leads" />
      </div>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Loader2 size={22} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "var(--hot)", padding: 8 }}>Error: {error}</div>}

      {data && !loading && (
        <>
          {/* Account intelligence — left date/category panel + right field table.
              Pulled from the signals sheet, which carries articles, bids/RFPs,
              AND school board minutes (source = "Minutes"). One unified stack. */}
          {data.signals.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {data.signals.length > 1 && (
                <h4 style={{ margin: 0, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "var(--f-body)" }}>Account Intelligence · {data.signals.length}</h4>
              )}
              {data.signals.map((s, i) => (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, display: "grid", gridTemplateColumns: "190px minmax(0,1fr)", overflow: "hidden" }}>
                  {/* Left panel: date + category */}
                  <div style={{ background: "var(--sunk)", padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, borderRight: "1px solid var(--line)" }}>
                    {s.Date && (
                      <div style={{ fontFamily: "var(--f-display)", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{fmtDate(s.Date)}</div>
                    )}
                    {s.Category && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontFamily: "var(--f-body)", fontWeight: 600 }}>Category</div>
                        <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "4px 12px", borderRadius: 100, fontWeight: 600, fontSize: 13, fontFamily: "var(--f-body)" }}>{s.Category}</span>
                      </div>
                    )}
                  </div>
                  {/* Right panel: labeled fields */}
                  <div style={{ padding: "16px 20px", display: "grid", gap: 10, minWidth: 0, fontFamily: "var(--f-body)", fontSize: 13.5, lineHeight: 1.5 }}>
                    {s.Keywords && (
                      <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: 10, alignItems: "baseline" }}>
                        <strong style={{ color: "var(--muted)", fontWeight: 700 }}>Keywords:</strong>
                        <span style={{ color: "var(--ink)" }}>{s.Keywords}</span>
                      </div>
                    )}
                    {s.Analysis && (
                      <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: 10, alignItems: "baseline" }}>
                        <strong style={{ color: "var(--muted)", fontWeight: 700 }}>Signal Analysis:</strong>
                        <span style={{ color: "var(--ink)" }}>{s.Analysis}</span>
                      </div>
                    )}
                    {s.SourceText && (
                      <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: 10, alignItems: "baseline" }}>
                        <strong style={{ color: "var(--muted)", fontWeight: 700 }}>Source Text:</strong>
                        <span style={{ color: "var(--ink)" }}>{s.SourceText}</span>
                      </div>
                    )}
                    {(s.Strength > 0 || s.Link || s.Source) && (
                      <div style={{ display: "flex", gap: 24, alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 2, flexWrap: "wrap" }}>
                        {s.Strength > 0 && (
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <strong style={{ color: "var(--muted)", fontWeight: 700 }}>Strength:</strong>
                            <span style={{ color: "var(--ink)", fontWeight: 700 }}>{s.Strength}</span>
                          </div>
                        )}
                        {(s.Link || s.Source) && (
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <strong style={{ color: "var(--muted)", fontWeight: 700 }}>Source:</strong>
                            {s.Link ? (
                              <a href={s.Link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                {signalLinkLabel(s)}
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span style={{ color: "var(--ink)" }}>{s.Source}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Two-column: persona + leads */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
            {/* Persona activity */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--f-body)" }}>Persona Activity</h4>
                {data.persona.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "50px 90px 50px", gap: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600, textAlign: "center", fontFamily: "var(--f-body)" }}>
                    <span>Users</span>
                    <span>Engagements</span>
                    <span>Leads</span>
                  </div>
                )}
              </div>
              {data.persona.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>No persona engagement recorded.</p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {data.persona.map((p, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 50px 90px 50px", gap: 0, alignItems: "center", fontSize: 13.5, fontFamily: "var(--f-body)" }}>
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>{p.JobFunction}</span>
                      <span style={{ textAlign: "center", color: "var(--ink)", fontWeight: 700 }}>{p.Users}</span>
                      <span style={{ textAlign: "center", color: "var(--ink)", fontWeight: 700 }}>{fmt(p.Engagements)}</span>
                      <span style={{ textAlign: "center", color: "var(--ink)", fontWeight: 700 }}>{p.Leads}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leads by job function */}
            {(() => {
              const leadsPersona = data.persona.filter(p => p.Leads > 0);
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", minWidth: 0 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--f-body)" }}>Leads by Job Function</h4>
                  {leadsPersona.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>No leads yet.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 14px", fontSize: 13.5, fontFamily: "var(--f-body)" }}>
                      {leadsPersona.map((p, i) => (
                        <React.Fragment key={i}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{p.JobFunction}</span>
                          <span style={{ textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>{p.Leads}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Topic Intelligence — ranked list with numbered rows and
              full-width bars. Score only (no placeholder trend). */}
          {data.topics.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 24px" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--f-display)", lineHeight: 1.2 }}>Topic Intelligence</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "var(--f-body)", marginTop: 3 }}>
                    {data.topics.length} topic{data.topics.length !== 1 ? "s" : ""} ranked by relevance score
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "var(--sunk)", padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: "var(--f-body)" }}>
                  Top {data.topics.length}
                </span>
              </div>

              {/* Column label */}
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 14, fontFamily: "var(--f-body)" }}>
                Topic / Relevance
              </div>

              {/* Ranked rows */}
              <div style={{ display: "grid", gap: 18 }}>
                {data.topics.map((t, i) => {
                  const pct = Math.min(100, Math.max(0, t.Score));
                  const barColor = i === 0 ? "var(--hot)" : "var(--warm)";
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 14, alignItems: "start" }}>
                      <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--f-body)", fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--f-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                            {t.Topic}
                          </span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--f-display)", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right", flexShrink: 0 }}>
                            {t.Score}
                          </span>
                        </div>
                        <div style={{ height: 6, background: "var(--sunk)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.signals.length === 0 && data.topics.length === 0 && data.persona.length === 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "var(--muted)" }}>
              No account intelligence, topics, or persona activity recorded for this district.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntentReportPage() {
  const { resetSignal } = useFilter();

  // All rows from API
  const [allRows, setAllRows] = useState<DistrictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters (client-side except date)
  const [campFilter, setCampFilter] = useState<string[]>(["C7"]);
  const [districtSearch, setDistrictSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>("IntentScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(50);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [printAll, setPrintAll] = useState(false);

  // Compute API date params
  const getApiDates = useCallback((): { dateStart: string; dateEnd: string } => {
    if (dateRange === "custom") return { dateStart: customFrom, dateEnd: customTo };
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    if (dateRange === "7d")  { const s = new Date(today); s.setDate(s.getDate() - 7);  return { dateStart: fmt(s), dateEnd: fmt(today) }; }
    if (dateRange === "30d") { const s = new Date(today); s.setDate(s.getDate() - 30); return { dateStart: fmt(s), dateEnd: fmt(today) }; }
    if (dateRange === "90d") { const s = new Date(today); s.setDate(s.getDate() - 90); return { dateStart: fmt(s), dateEnd: fmt(today) }; }
    return { dateStart: "", dateEnd: "" };
  }, [dateRange, customFrom, customTo]);

  // Reset on global reset
  useEffect(() => {
    if (resetSignal === 0) return;
    setCampFilter([]);
    setDistrictSearch("");
    setStateFilter([]);
    setScoreMin("");
    setScoreMax("");
    setDateRange("all");
    setCustomFrom("");
    setCustomTo("");
  }, [resetSignal]);

  // Show all rows when printing, restore after
  useEffect(() => {
    const before = () => setPrintAll(true);
    const after  = () => setPrintAll(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint",  after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { dateStart, dateEnd } = getApiDates();
    const params = new URLSearchParams();
    if (campFilter.length) params.set("campaign", campFilter.join(","));
    if (stateFilter.length) params.set("state", stateFilter.join(","));
    if (dateStart) params.set("dateStart", dateStart);
    if (dateEnd)   params.set("dateEnd", dateEnd);
    try {
      const res = await fetch(`/api/intent-report-data?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAllRows(json.rows ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [campFilter, stateFilter, getApiDates]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Unique campaign options from data
  const campaignOptions = [...new Set(allRows.map((r) => r.Campaign).filter(Boolean))].sort();

  // Valid 2-letter US state codes — guards against dirty BigQuery values ("ENGLAND", "cState", etc.)
  const US_STATES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"]);

  // State options with counts (from all rows, ignoring state filter)
  const stateOptions = (() => {
    const counts: Record<string, number> = {};
    allRows.forEach((r) => { if (r.State && US_STATES.has(r.State)) counts[r.State] = (counts[r.State] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([state, count]) => ({ state, count }));
  })();

  // Client-side filtered rows
  const filteredRows = allRows.filter((r) => {
    if (campFilter.length && !campFilter.includes(r.Campaign)) return false;
    if (districtSearch) {
      const q = districtSearch.toLowerCase();
      if (!r.District.toLowerCase().includes(q) && !r.Domain.toLowerCase().includes(q)) return false;
    }
    if (stateFilter.length && !stateFilter.includes(r.State)) return false;
    const min = scoreMin !== "" ? Number(scoreMin) : null;
    const max = scoreMax !== "" ? Number(scoreMax) : null;
    if (min !== null && r.IntentScore < min) return false;
    if (max !== null && r.IntentScore > max) return false;
    return true;
  });

  // Sort
  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    const as = String(av ?? "");
    const bs = String(bv ?? "");
    return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  const visibleRows = printAll ? sortedRows : sortedRows.slice(0, visibleCount);

  // Hide Trend column entirely when every row in the current view has a 0 trend
  const hideTrend = filteredRows.length > 0 && filteredRows.every((r) => r.Trend === 0);

  // KPIs
  const kpiDistricts    = filteredRows.length;
  const kpiEngagements  = filteredRows.reduce((s, r) => s + r.Engagements, 0);
  const kpiEngagedUsers = filteredRows.reduce((s, r) => s + r.EngagedUsers, 0);
  const kpiLeads        = filteredRows.reduce((s, r) => s + r.Leads, 0);
  const kpiLeadDistricts = filteredRows.filter((r) => r.Leads > 0).length;

  // State bar chart (top 12, valid US codes only)
  const stateBarData = (() => {
    const counts: Record<string, number> = {};
    filteredRows.forEach((r) => { if (r.State && US_STATES.has(r.State)) counts[r.State] = (counts[r.State] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  })();
  const maxStateCount = stateBarData[0]?.[1] ?? 1;

  // Intent distribution
  const bandCounts = { High: 0, Elevated: 0, Moderate: 0, Early: 0 };
  filteredRows.forEach((r) => {
    if      (r.IntentScore >= 80) bandCounts.High++;
    else if (r.IntentScore >= 50) bandCounts.Elevated++;
    else if (r.IntentScore >= 25) bandCounts.Moderate++;
    else if (r.IntentScore >= 1)  bandCounts.Early++;
  });
  const totalBanded = bandCounts.High + bandCounts.Elevated + bandCounts.Moderate + bandCounts.Early;
  const maxIntentScore = allRows.length ? Math.max(...allRows.map(r => r.IntentScore)) : 200;
  const q25 = bandCounts.High + bandCounts.Elevated + bandCounts.Moderate;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Active filter chips
  const chips: { label: string; onRemove: () => void }[] = [];
  campFilter.forEach((c) => chips.push({ label: `Campaign: ${c}`, onRemove: () => setCampFilter(campFilter.filter((x) => x !== c)) }));
  stateFilter.forEach((s) => chips.push({ label: `State: ${s}`, onRemove: () => setStateFilter(stateFilter.filter((x) => x !== s)) }));
  if (scoreMin) chips.push({ label: `Score ≥ ${scoreMin}`, onRemove: () => setScoreMin("") });
  if (scoreMax) chips.push({ label: `Score ≤ ${scoreMax}`, onRemove: () => setScoreMax("") });
  if (districtSearch) chips.push({ label: `"${districtSearch}"`, onRemove: () => setDistrictSearch("") });

  function resetFilters() {
    setCampFilter([]);
    setDistrictSearch("");
    setStateFilter([]);
    setScoreMin("");
    setScoreMax("");
  }

  function handleExportCsv() {
    const cols = [
      "District", "Domain", "State", "Campaign", "Intent Score", "Account Intel", "Topic Insights",
      "Engagements", "Engaged Users", "Leads", "Trend", "Latest Activity",
    ].map((k) => ({ display_name: k, base_type: "type/Text" }));
    const rows = sortedRows.map((r) => [
      r.District, r.Domain, r.State, r.Campaign, r.IntentScore, r.AccountIntel, r.TopicInsights,
      r.Engagements, r.EngagedUsers, r.Leads, r.Trend, r.LastActivity,
    ]);
    exportToCsv("DATIA-District-Intent-Report", cols as never, rows as never);
  }

  const COL_HEADERS: { label: string; key: SortKey; align?: "right" | "center" }[] = [
    { label: "District",        key: "District" },
    { label: "State",           key: "State" },
    { label: "Intent Score",    key: "IntentScore",   align: "right" },
    { label: "Account Intel",   key: "AccountIntel",  align: "center" },
    { label: "Topic Insights",  key: "TopicInsights", align: "center" },
    ...(hideTrend ? [] : [{ label: "Trend", key: "Trend" as SortKey, align: "right" as const }]),
    { label: "Engagements",     key: "Engagements",   align: "right" },
    { label: "Engaged Users",   key: "EngagedUsers",  align: "right" },
    { label: "Leads",           key: "Leads",         align: "right" },
    { label: "Latest Activity", key: "LastActivity" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Public+Sans:wght@400;500;600;700&display=swap');
        :root {
          --bg:#F3F6F7; --surface:#FFFFFF; --sunk:#EAF0F1; --ink:#14232A; --muted:#566A73; --line:#D8E1E4;
          --accent:#0B6E78; --accent-ink:#FFFFFF; --accent-soft:#DDEFF1;
          --hot:#C2410C; --hot-soft:#FDE7DC; --warm:#B45309; --warm-soft:#FCEFD6; --act:#0B6E78; --low:#8597A0;
          --up:#15803D; --down:#B91C1C;
          --f-display:"Archivo","Helvetica Neue",Arial,sans-serif;
          --f-body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --bg:#0E161A; --surface:#152127; --sunk:#1B2A31; --ink:#E4ECEF; --muted:#93A5AE; --line:#263740;
            --accent:#4FB3BD; --accent-ink:#06191C; --accent-soft:#173A40;
            --hot:#FB8B4E; --hot-soft:#3D2117; --warm:#F2B04A; --warm-soft:#3A2C12; --act:#4FB3BD; --low:#6E828C;
            --up:#4ADE80; --down:#F87171;
          }
        }
        :root[data-theme="dark"] {
          --bg:#0E161A; --surface:#152127; --sunk:#1B2A31; --ink:#E4ECEF; --muted:#93A5AE; --line:#263740;
          --accent:#4FB3BD; --accent-ink:#06191C; --accent-soft:#173A40;
          --hot:#FB8B4E; --hot-soft:#3D2117; --warm:#F2B04A; --warm-soft:#3A2C12; --act:#4FB3BD; --low:#6E828C;
          --up:#4ADE80; --down:#F87171;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ir-row:hover td { background: var(--sunk) !important; }
        .ir-row:focus-within td { outline: 2px solid var(--accent); outline-offset: -2px; }
        /* Thick, accent-colored horizontal scrollbar so overflow is obvious
           on every device. iOS hides touch scrollbars no matter what CSS
           says, so the swipe-hint badge above also renders on narrow views. */
        .ir-table-box { scrollbar-width: auto; scrollbar-color: var(--accent) var(--sunk); }
        .ir-table-box::-webkit-scrollbar { height: 14px; -webkit-appearance: none; }
        .ir-table-box::-webkit-scrollbar-track { background: var(--sunk); border-radius: 0 0 12px 12px; }
        .ir-table-box::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 7px; border: 2px solid var(--sunk); min-width: 60px; }
        .ir-table-box::-webkit-scrollbar-thumb:hover { background: var(--ink); }
        /* Swipe-hint pill — shown only on viewports too narrow for the full
           table (same ~1200px threshold as the table's min-width). Hidden on
           wide screens so power users don't see noise. */
        .ir-scroll-hint { display: none; }
        @media (max-width: 1280px) {
          .ir-scroll-hint {
            display: inline-flex; align-items: center; gap: 6px;
            margin-bottom: 8px; padding: 6px 12px;
            background: var(--accent-soft); color: var(--accent);
            border: 1px solid var(--accent); border-radius: 999px;
            font-family: var(--f-body); font-size: 12px; font-weight: 700;
            letter-spacing: .04em; text-transform: uppercase;
          }
        }
        .ir-print-cover { display: none; }
        @media print {
          @page { size: letter landscape; margin: 1.2cm 2cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          aside, .ir-no-print { display: none !important; }
          body { background: white !important; font-family: "Public Sans", sans-serif; }
          .ir-container { position: static !important; left: 0 !important; top: 0 !important; overflow: visible !important; background: white !important; height: auto !important; display: block !important; }
          .ir-print-cover { display: block !important; margin-bottom: 22px; }
          .ir-screen-header { display: none !important; }
          .ir-filter-bar { display: none !important; }
          .ir-table-box { overflow: visible !important; }
          .ir-kpi-strip { page-break-inside: avoid; break-inside: avoid; }
          .ir-split-section { page-break-inside: avoid; break-inside: avoid; }
          table { min-width: 0 !important; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          h2 { page-break-after: avoid; break-after: avoid; }
          .ir-table-box thead tr th {
            background: #0B6E78 !important;
            color: white !important;
            border-bottom: none !important;
          }
          .ir-row td { font-size: 11.5px !important; }
        }
      `}</style>

      <div className="ir-container" style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "var(--bg)", zIndex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "0 20px" }}>

          {/* ── Print cover (hidden on screen, shown when printing) ── */}
          <div className="ir-print-cover">
            <div style={{ background:"#0B6E78", color:"white", padding:"18px 28px 16px", borderRadius:"8px 8px 0 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", opacity:.75, fontFamily:"\"Public Sans\",sans-serif", marginBottom:6 }}>ABMxi · DATIA K12</div>
                <div style={{ fontFamily:"\"Archivo\",sans-serif", fontSize:26, fontWeight:800, lineHeight:1.1 }}>District Intent Report</div>
                <div style={{ fontSize:12.5, marginTop:6, opacity:.85, fontFamily:"\"Public Sans\",sans-serif" }}>
                  Districts showing before- and after-school care intent, ranked by intent score.
                </div>
              </div>
              <div style={{ textAlign:"right", fontFamily:"\"Public Sans\",sans-serif", fontSize:12, lineHeight:1.7 }}>
                <div style={{ opacity:.9 }}>Generated {new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</div>
                {campFilter.length > 0 && <div style={{ opacity:.9 }}>Campaign: {campFilter.join(" · ")}</div>}
                <div style={{ opacity:.75 }}>Showing {fmt(filteredRows.length)} of {fmt(allRows.length)} districts</div>
              </div>
            </div>
            {chips.length > 0 && (
              <div style={{ background:"#EAF5F6", borderLeft:"3px solid #0B6E78", borderRight:"1px solid #cce4e6", borderBottom:"1px solid #cce4e6", padding:"8px 28px", fontSize:12, color:"#566A73", fontFamily:"\"Public Sans\",sans-serif", borderRadius:"0 0 8px 8px" }}>
                <strong style={{ color:"#0B6E78" }}>Filters active:</strong>{" "}{chips.map((c) => c.label).join(" · ")}
              </div>
            )}
            {chips.length === 0 && (
              <div style={{ background:"#EAF5F6", borderLeft:"3px solid #0B6E78", borderRight:"1px solid #cce4e6", borderBottom:"1px solid #cce4e6", padding:"8px 28px", fontSize:12, color:"#566A73", fontFamily:"\"Public Sans\",sans-serif", borderRadius:"0 0 8px 8px" }}>
                All campaigns · All dates · Full dataset
              </div>
            )}
          </div>

          {/* ── Page header ── */}
          <div className="ir-screen-header" style={{ padding: "32px 0 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--muted)", fontFamily: "var(--f-body)", marginBottom: 6 }}>
                ABMxi · DATIA K12
              </div>
              <h1 style={{ fontFamily: "var(--f-display)", fontSize: 36, fontWeight: 800, color: "var(--ink)", margin: 0, lineHeight: 1.1 }}>
                District Intent Report
              </h1>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8, fontFamily: "var(--f-body)" }}>
                Districts showing before- and after-school care intent, ranked by intent score.
              </p>
            </div>
            {/* Export actions */}
            <div className="ir-no-print" style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={resetFilters}
                disabled={chips.length === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  fontSize: 13, fontWeight: 600, cursor: chips.length === 0 ? "default" : "pointer",
                  borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)",
                  color: chips.length === 0 ? "var(--low)" : "var(--muted)",
                  fontFamily: "var(--f-body)", opacity: chips.length === 0 ? 0.5 : 1,
                }}
              >
                <X size={14} /> Reset filters
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 8,
                  border: "1px solid var(--line)", background: "var(--surface)",
                  color: "var(--muted)", fontFamily: "var(--f-body)",
                }}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 8,
                  border: "1px solid var(--accent)", background: "var(--accent)",
                  color: "var(--accent-ink)", fontFamily: "var(--f-body)",
                }}
              >
                <Printer size={14} /> Print / Export PDF
              </button>
            </div>
          </div>

          {/* ── Sticky filter bar ── */}
          <div className="ir-filter-bar ir-no-print" style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--bg)", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1.4fr 1fr .8fr 1.9fr", gap: 12, paddingTop: 12 }}>
              {/* Campaign */}
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--f-body)" }}>Campaign</label>
                <CampaignPopover options={campaignOptions} selected={campFilter} onChange={setCampFilter} />
              </div>

              {/* District search */}
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--f-body)" }}>District</label>
                <input
                  type="search"
                  placeholder="Search name or domain…"
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)", boxSizing: "border-box" }}
                />
              </div>

              {/* Date range */}
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--f-body)" }}>Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)" }}
                >
                  <option value="all">All dates</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="custom">Custom range…</option>
                </select>
                {dateRange === "custom" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ flex: 1, padding: "5px 6px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)" }} />
                    <input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}   style={{ flex: 1, padding: "5px 6px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)" }} />
                  </div>
                )}
              </div>

              {/* State */}
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--f-body)" }}>State</label>
                <StatePopover options={stateOptions} selected={stateFilter} onChange={setStateFilter} />
              </div>

              {/* Intent score */}
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--f-body)" }}>Intent Score</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={scoreMin}
                    onChange={(e) => setScoreMin(e.target.value)}
                    style={{ flex: 1, height: 36, padding: "0 10px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)" }}
                  />
                  <span style={{ color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={scoreMax}
                    onChange={(e) => setScoreMax(e.target.value)}
                    style={{ flex: 1, height: 36, padding: "0 10px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--f-body)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[
                    { label: "High",     min: "80",  max: ""   },
                    { label: "Elevated", min: "50",  max: "79" },
                    { label: "Moderate", min: "25",  max: "49" },
                    { label: "Early",    min: "1",   max: "24" },
                  ].map(({ label, min, max }) => {
                    const active = scoreMin === min && scoreMax === max;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => { setScoreMin(min); setScoreMax(max); }}
                        style={{
                          height: 36, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                          fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                          background: active ? "var(--accent)" : "var(--surface)",
                          color: active ? "var(--accent-ink)" : "var(--ink)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active chips */}
            {chips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
                      background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 100,
                      fontSize: 12, fontFamily: "var(--f-body)", fontWeight: 500,
                    }}
                  >
                    {chip.label}
                    <button type="button" onClick={chip.onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--accent)", lineHeight: 1 }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <Loader2 size={32} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {error && <div style={{ padding: 24, color: "var(--hot)", fontSize: 14, fontFamily: "var(--f-body)" }}>Error loading data: {error}</div>}

          {!loading && !error && (
            <>
              {/* ── Status row ── */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"14px 0 4px", flexWrap:"wrap" }}>
                <p style={{ margin:0, color:"var(--muted)", fontSize:13, fontFamily:"var(--f-body)" }}>
                  Showing <strong style={{ color:"var(--ink)" }}>{fmt(filteredRows.length)}</strong> of <span>{fmt(allRows.length)}</span> districts
                </p>
              </div>

              {/* ── KPI strip ── */}
              <div className="ir-kpi-strip" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", border:"1px solid var(--line)", borderRadius:10, background:"var(--surface)", marginTop:12 }}>
                {[
                  { k: "Districts",       v: fmt(kpiDistricts) },
                  { k: "Engagements",     v: fmt(kpiEngagements) },
                  { k: "Engaged Users",   v: fmt(kpiEngagedUsers) },
                  { k: `Leads · ${kpiLeadDistricts} districts`, v: fmt(kpiLeads) },
                ].map(({ k, v }, i) => (
                  <div key={k} style={{ padding:"16px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--line)" }}>
                    <div style={{ fontFamily:"var(--f-display)", fontWeight:800, fontSize:28, lineHeight:1, color:"var(--accent)" }}>{v}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:6, fontFamily:"var(--f-body)" }}>{k}</div>
                  </div>
                ))}
              </div>

              {/* ── Two-column split ── */}
              <div className="ir-split-section" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, marginTop: 24, marginBottom: 28 }}>
                {/* Districts by state bar chart */}
                <div>
                  <h2 style={{ fontFamily:"var(--f-display)", fontWeight:700, fontSize:17, margin:"0 0 4px", color:"var(--ink)" }}>Districts by state</h2>
                  <p style={{ color:"var(--muted)", fontSize:12.5, margin:"0 0 12px", fontFamily:"var(--f-body)" }}>Top 12 states in the current view. Click a bar to filter.</p>
                  {stateBarData.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>No data.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      {stateBarData.map(([state, count]) => {
                        const pct = (count / maxStateCount) * 100;
                        const active = stateFilter.includes(state);
                        return (
                          <button
                            key={state}
                            type="button"
                            onClick={() => setStateFilter(active ? stateFilter.filter((s) => s !== state) : [...stateFilter, state])}
                            aria-pressed={active}
                            style={{ display:"grid", gridTemplateColumns:"34px 1fr 56px", gap:8, alignItems:"center", background:"none", border:"none", cursor:"pointer", padding:"2px 0", textAlign:"left", borderRadius:4, width:"100%" }}
                          >
                            <span style={{ fontSize:12.5, fontWeight:700, color: active ? "var(--accent)" : "var(--ink)" }}>{state}</span>
                            <div style={{ height:16, background:"var(--sunk)", borderRadius:3, overflow:"hidden" }}>
                              <div style={{ width:`${pct}%`, height:"100%", background: active ? "var(--accent)" : "var(--accent)", borderRadius:3, opacity: active ? 1 : 0.65 }} />
                            </div>
                            <span style={{ fontSize:12.5, color:"var(--muted)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Intent score distribution */}
                <div>
                  <h2 style={{ fontFamily:"var(--f-display)", fontWeight:700, fontSize:17, margin:"0 0 4px", color:"var(--ink)" }}>Intent score distribution</h2>
                  <p style={{ color:"var(--muted)", fontSize:12.5, margin:"0 0 12px", fontFamily:"var(--f-body)" }}>Districts in the current view, grouped by intent band.</p>
                  <div style={{ border:"1px solid var(--line)", borderRadius:8, background:"var(--surface)", overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ background:"var(--sunk)", padding:"10px 14px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".07em", textAlign:"left", whiteSpace:"nowrap" }}>Score Band</th>
                          <th style={{ background:"var(--sunk)", padding:"10px 14px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".07em", textAlign:"right", whiteSpace:"nowrap", width:80 }}>Districts</th>
                          <th style={{ background:"var(--sunk)", padding:"10px 14px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".07em", textAlign:"left", whiteSpace:"nowrap" }}>Distribution (25+)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          { label:"High",     sub:"80+",   color:"var(--hot)",  count:bandCounts.High,     showBar:true  },
                          { label:"Elevated", sub:"50–79", color:"var(--warm)", count:bandCounts.Elevated,  showBar:true  },
                          { label:"Moderate", sub:"25–49", color:"var(--act)",  count:bandCounts.Moderate,  showBar:true  },
                          { label:"Early",    sub:"1–24",  color:"var(--low)",  count:bandCounts.Early,     showBar:false },
                        ] as { label: string; sub: string; color: string; count: number; showBar: boolean }[]).map(({ label, sub, color, count, showBar }, i) => (
                          <tr key={label}>
                            <td style={{ padding:"11px 14px", fontSize:13, borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                              <strong style={{ fontFamily:"var(--f-body)" }}>{label}</strong>{" "}
                              <span style={{ color:"var(--muted)", fontFamily:"var(--f-body)" }}>{sub}</span>
                            </td>
                            <td style={{ padding:"11px 14px", fontSize:13, textAlign:"right", fontVariantNumeric:"tabular-nums", borderTop: i === 0 ? "none" : "1px solid var(--line)", fontFamily:"var(--f-body)" }}>{fmt(count)}</td>
                            <td style={{ padding:"11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                              {showBar && count > 0 && q25 > 0 ? (
                                <div style={{ height:16, background:"var(--sunk)", borderRadius:3, overflow:"hidden" }}>
                                  <div style={{ width:`${(count/q25*100).toFixed(1)}%`, height:"100%", background:color, borderRadius:3 }} />
                                </div>
                              ) : <span style={{ color:"var(--muted)", fontFamily:"var(--f-body)" }}>–</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize:12.5, color:"var(--muted)", margin:"10px 0 0", fontFamily:"var(--f-body)" }}>
                    {campFilter.length === 1
                      ? `All dates: full-campaign totals for ${campFilter[0]}, matching the live dashboard.`
                      : campFilter.length > 1
                      ? `All dates: full-campaign totals for ${campFilter.join(", ")}, matching the live dashboard.`
                      : "All dates: full-campaign totals across all campaigns, matching the live dashboard."}
                  </p>
                </div>
              </div>

              {/* ── Main table ── */}
              <div className="ir-scroll-hint ir-no-print" aria-hidden="true">
                <span>←</span><span>Scroll horizontally for more</span><span>→</span>
              </div>
              <div className="ir-table-box" style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflowX: "scroll", overflowY: "visible", marginBottom: 40 }}>
                <table style={{ width: "100%", minWidth: 1200, borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--f-body)" }}>
                  <thead>
                    <tr style={{ background: "var(--surface)" }}>
                      {COL_HEADERS.map(({ label, key, align }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                          style={{
                            textAlign: align ?? "left", padding: "11px 14px", fontSize: 11,
                            fontWeight: 700, color: "var(--muted)", textTransform: "uppercase",
                            letterSpacing: ".08em", cursor: "pointer", userSelect: "none",
                            borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                          {sortKey === key && (
                            <span style={{ marginLeft: 4, color: "var(--accent)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const rowKey = `${row.District}|${row.Domain}`;
                      const expanded = expandedRow === rowKey;
                      const band = intentBand(row.IntentScore);
                      const barPct = maxIntentScore > 0 ? Math.min(100, (row.IntentScore / maxIntentScore) * 100) : 0;
                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            className="ir-row"
                            tabIndex={0}
                            onClick={() => setExpandedRow(expanded ? null : rowKey)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedRow(expanded ? null : rowKey); } }}
                            style={{ cursor: "pointer", borderBottom: expanded ? "none" : "1px solid var(--line)" }}
                            aria-expanded={expanded}
                          >
                            {/* District */}
                            <td style={{ padding: "12px 14px", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.3 }}>
                                {row.District}
                              </div>
                              {row.Domain && <div style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>{row.Domain}</div>}
                            </td>
                            {/* State */}
                            <td style={{ padding: "12px 14px", color: "var(--muted)", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>{row.State}</td>
                            {/* Intent score */}
                            <td style={{ padding: "12px 14px", textAlign: "right", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                                <div style={{ width: 54, height: 6, background: "var(--sunk)", borderRadius: 3, flexShrink: 0 }}>
                                  <div style={{ width: `${barPct}%`, height: "100%", background: band.color, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontFamily:"var(--f-display)", fontWeight:800, fontSize:16, minWidth:30, textAlign:"right", color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{row.IntentScore}</span>
                              </div>
                            </td>
                            {/* Account Intel */}
                            <td style={{ padding: "12px 14px", textAlign: "center", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>
                              {row.AccountIntel === "Y" ? (
                                <span style={{ display: "inline-block", minWidth: 22, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700, fontSize: 12, fontFamily: "var(--f-body)" }}>Y</span>
                              ) : (
                                <span style={{ display: "inline-block", minWidth: 22, padding: "2px 8px", borderRadius: 100, background: "var(--sunk)", color: "var(--low)", fontWeight: 700, fontSize: 12, fontFamily: "var(--f-body)" }}>N</span>
                              )}
                            </td>
                            {/* Topic Insights */}
                            <td style={{ padding: "12px 14px", textAlign: "center", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>
                              {row.TopicInsights === "Y" ? (
                                <span style={{ display: "inline-block", minWidth: 22, padding: "2px 8px", borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700, fontSize: 12, fontFamily: "var(--f-body)" }}>Y</span>
                              ) : (
                                <span style={{ display: "inline-block", minWidth: 22, padding: "2px 8px", borderRadius: 100, background: "var(--sunk)", color: "var(--low)", fontWeight: 700, fontSize: 12, fontFamily: "var(--f-body)" }}>N</span>
                              )}
                            </td>
                            {/* Trend */}
                            {!hideTrend && (
                              <td style={{ padding: "12px 14px", textAlign: "right", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>
                                {row.Trend > 0
                                  ? <span style={{ color: "var(--up)", fontWeight: 600 }}>▲ {fmt(row.Trend)}</span>
                                  : row.Trend < 0
                                  ? <span style={{ color: "var(--down)", fontWeight: 600 }}>▼ {fmt(Math.abs(row.Trend))}</span>
                                  : <span style={{ color: "var(--low)" }}>0</span>
                                }
                              </td>
                            )}
                            {/* Engagements */}
                            <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--muted)", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>{fmt(row.Engagements)}</td>
                            {/* Engaged Users */}
                            <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--muted)", background: expanded ? "var(--accent-soft)" : "var(--surface)" }}>{fmt(row.EngagedUsers)}</td>
                            {/* Leads */}
                            <td style={{ padding: "12px 14px", textAlign: "right", background: expanded ? "var(--accent-soft)" : "var(--surface)", fontWeight: row.Leads > 0 ? 700 : 400, color: row.Leads > 0 ? "var(--ink)" : "var(--muted)" }}>{fmt(row.Leads)}</td>
                            {/* Latest Activity */}
                            <td style={{ padding: "12px 14px", color: "var(--muted)", background: expanded ? "var(--accent-soft)" : "var(--surface)", fontSize: 12 }}>{fmtDate(row.LastActivity)}</td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={hideTrend ? 9 : 10} style={{ padding: 0 }}>
                                <ExpandedCard district={row.District} row={row} campaigns={campFilter} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {visibleCount < sortedRows.length && (
                  <div className="ir-no-print" style={{ padding: "16px 20px", borderTop: "1px solid var(--line)", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + 50)}
                      style={{ height:36, padding:"0 16px", borderRadius:8, border:"1px solid var(--accent)", background:"var(--surface)", color:"var(--accent)", fontWeight:700, cursor:"pointer", fontFamily:"var(--f-body)", fontSize:13 }}
                    >
                      Show 50 more ({sortedRows.length - visibleCount} remaining)
                    </button>
                  </div>
                )}

                {sortedRows.length === 0 && (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14, fontFamily: "var(--f-body)" }}>
                    No districts match the current filters.
                  </div>
                )}
              </div>

              <footer style={{ color:"var(--muted)", fontSize:12, paddingBlock:"24px 40px", fontFamily:"var(--f-body)" }}>
                Source: live Right At School scoring table, pulled from the ABMxi dashboard. Intent bands: High 80+, Elevated 50–79, Moderate 25–49, Early 1–24.
              </footer>
            </>
          )}
        </div>
      </div>
    </>
  );
}
