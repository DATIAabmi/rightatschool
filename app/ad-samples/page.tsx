"use client";

import { useEffect, useRef, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { useFilter } from "@/components/FilterContext";
import { EMAIL_HTML } from "./email-html";

const C7 = "C7: July 2026 - June 2027";

// Assets available per campaign. Add new entries here as campaigns are loaded.
const CAMPAIGN_ASSETS: Record<string, { social: { src: string; alt: string }[]; email: string | null; display: { src: string; alt: string }[] }> = {
  [C7]: {
    social: [
      { src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1787840518/RAS_FB_tlfggo.jpg",      alt: "Facebook ad" },
      { src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1787840519/RAS_LinkedIn_kpx4hf.jpg", alt: "LinkedIn ad" },
    ],
    email: EMAIL_HTML,
    display: [
      { src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1787840518/300x250-2_d997kg.jpg",   alt: "Display 300x250" },
      { src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1787840519/300x600_cdwcuu.jpg",     alt: "Display 300x600" },
      { src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1787840519/970x250_1_anr7xj.gif",   alt: "Display 970x250" },
    ],
  },
};

const EMAIL_NATIVE_W = 600;
const EMAIL_NATIVE_H = 920;

function ColHeader({ label }: { label: string }) {
  return (
    <div style={{
      textAlign: "center", fontWeight: 700, fontSize: 14,
      letterSpacing: "0.08em", color: "#111",
      padding: "10px 16px", border: "1px solid #d1d5db",
      borderRadius: 6, marginBottom: 20, background: "#fff",
    }}>
      {label}
    </div>
  );
}

function AdImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img src={src} alt={alt} loading="lazy" style={{
      width: "100%", display: "block", borderRadius: 6,
      boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
    }} />
  );
}

function EmailPreview({ html }: { html: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / EMAIL_NATIVE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: EMAIL_NATIVE_H * scale, overflow: "hidden", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}>
      <iframe srcDoc={html} sandbox="allow-same-origin" style={{ width: EMAIL_NATIVE_W, height: EMAIL_NATIVE_H, border: "none", display: "block", transformOrigin: "top left", transform: `scale(${scale})` }} />
    </div>
  );
}

function CampaignBadge({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "6px 14px", background: "#1e293b", borderRadius: 20, alignSelf: "flex-start" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", flexShrink: 0, display: "block" }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", letterSpacing: "0.05em" }}>{label}</span>
    </div>
  );
}

function NoSamples({ campaignLabel }: { campaignLabel: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 12, color: "#9ca3af" }}>
      <svg width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h4" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 14, margin: 0, textAlign: "center" }}>
        No ad samples loaded for<br />
        <strong style={{ color: "#6b7280" }}>{campaignLabel}</strong>
      </p>
    </div>
  );
}

export default function Page() {
  const { campaign } = useFilter();

  // Determine which campaign's assets to show.
  // Single campaign selected → use it if we have assets, else show empty state.
  // Multiple or none → fall back to C7 (most recent with assets).
  const activeCampaign = campaign.length === 1 ? campaign[0] : C7;
  const assets = CAMPAIGN_ASSETS[activeCampaign] ?? null;
  const campaignLabel = campaign.length === 1 ? activeCampaign : "All Campaigns (showing C7)";

  return (
    <div style={{ position: "fixed", top: 0, left: "16rem", right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
        <DashboardHeader />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 28px 28px" }}>
        <CampaignBadge label={campaignLabel} />

        {!assets ? (
          <NoSamples campaignLabel={activeCampaign} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, alignItems: "start" }}>
            {/* Social Media — images capped so they don't blow out the column */}
            <div>
              <ColHeader label="SOCIAL MEDIA" />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {assets.social.map((img) => (
                  <div key={img.src} style={{ maxWidth: 340, margin: "0 auto", width: "100%" }}>
                    <AdImg src={img.src} alt={img.alt} />
                  </div>
                ))}
              </div>
            </div>

            {/* Email */}
            <div>
              <ColHeader label="EMAIL" />
              {assets.email ? <EmailPreview html={assets.email} /> : <NoSamples campaignLabel={activeCampaign} />}
            </div>

            {/* Digital Display — first two side by side, wide banner spans full width */}
            <div>
              <ColHeader label="DIGITAL DISPLAY" />
              {assets.display.length === 0 ? null : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {assets.display.slice(0, -1).map((img) => (
                    <AdImg key={img.src} src={img.src} alt={img.alt} />
                  ))}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <AdImg src={assets.display[assets.display.length - 1].src} alt={assets.display[assets.display.length - 1].alt} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
