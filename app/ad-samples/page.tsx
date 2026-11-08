"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

type AssetType = "Social" | "Email" | "Display";

interface Creative {
  campaign: string;
  assetNum: string;
  type: AssetType;
  src: string;
  alt: string;
}

// Add new campaign assets here — no other code needs to change.
// assetNum uses the zero-padded form ("01", "02", …) so it matches the
// asset_code values the ad_performance table filter dropdown shows.
// Campaign → asset mapping follows the Cloudinary filename titles (e.g.
// RightAtSchool.C3.asset02.Display → C3 Asset 02).
const CREATIVES: Creative[] = [
  // ── C1 · Asset 01 ───────────────────────────────────────────────
  { campaign: "C1", assetNum: "01", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167625/RightAtSchool.C1.asset01.Display_iz0a0f.png", alt: "C1 Asset 01 Display" },
  { campaign: "C1", assetNum: "01", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167625/RightAtSchool.C1.asset01.Email_hqhax5.png",   alt: "C1 Asset 01 Email" },
  { campaign: "C1", assetNum: "01", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167625/RightAtSchool.C1.asset01.Social_hsa7ow.png",  alt: "C1 Asset 01 Social" },

  // ── C2 · Asset 01 ───────────────────────────────────────────────
  { campaign: "C2", assetNum: "01", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C2.asset01.Display_yw2vql.png", alt: "C2 Asset 01 Display" },
  { campaign: "C2", assetNum: "01", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C2.asset01.Email_hmubvc.png",   alt: "C2 Asset 01 Email" },
  { campaign: "C2", assetNum: "01", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C2.asset01.Social_ek0hvo.png",  alt: "C2 Asset 01 Social" },

  // ── C3 · Asset 02 ───────────────────────────────────────────────
  { campaign: "C3", assetNum: "02", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167625/RightAtSchool.C3.asset02.Display_da3vzt.png", alt: "C3 Asset 02 Display" },
  { campaign: "C3", assetNum: "02", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167625/RightAtSchool.C3.asset02.Email_wxqs11.png",   alt: "C3 Asset 02 Email" },
  { campaign: "C3", assetNum: "02", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C3.asset02.Social_wptvag.png",  alt: "C3 Asset 02 Social" },

  // ── C4 · Asset 03 ───────────────────────────────────────────────
  { campaign: "C4", assetNum: "03", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C4.asset03.Display_m82s2y.png", alt: "C4 Asset 03 Display" },
  { campaign: "C4", assetNum: "03", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C4.asset03.Email_zqnoyg.png",   alt: "C4 Asset 03 Email" },
  { campaign: "C4", assetNum: "03", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1794167626/RightAtSchool.C4.asset03.Social_chjzsh.png",  alt: "C4 Asset 03 Social" },

  // ── C5 · Asset 04 ───────────────────────────────────────────────
  { campaign: "C5", assetNum: "04", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278436/RightAtSchool.C5.Asset1.Display_xlpbn2.png",  alt: "C5 Asset 04 Display" },
  { campaign: "C5", assetNum: "04", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C5.Asset1.Email_wom14m.png",    alt: "C5 Asset 04 Email" },
  { campaign: "C5", assetNum: "04", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C5.Asset1.Social_j2g3iv.png",   alt: "C5 Asset 04 Social" },

  // ── C6 · Asset 05 ───────────────────────────────────────────────
  { campaign: "C6", assetNum: "05", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C6.Asset1.Display_mgfphu.png",  alt: "C6 Asset 05 Display" },
  { campaign: "C6", assetNum: "05", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C6.Asset1.Email_upsyj4.png",    alt: "C6 Asset 05 Email" },
  { campaign: "C6", assetNum: "05", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C6.Asset1.Social_z2xcqc.png",   alt: "C6 Asset 05 Social" },

  // ── C7 · Asset 06 ───────────────────────────────────────────────
  { campaign: "C7", assetNum: "06", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset1.Social_t3mod3.png",   alt: "C7 Asset 06 Social" },
  { campaign: "C7", assetNum: "06", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset1.Display_a6xco0.png",  alt: "C7 Asset 06 Display" },
  { campaign: "C7", assetNum: "06", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset1.Email_kecrld.png",    alt: "C7 Asset 06 Email" },

  // ── C7 · Asset 07 ───────────────────────────────────────────────
  { campaign: "C7", assetNum: "07", type: "Social",  src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset2.Social_czki55.png",   alt: "C7 Asset 07 Social" },
  { campaign: "C7", assetNum: "07", type: "Display", src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset2.Display_o3x5qf.png",  alt: "C7 Asset 07 Display" },
  { campaign: "C7", assetNum: "07", type: "Email",   src: "https://res.cloudinary.com/dkfcflgtp/image/upload/v1792278435/RightAtSchool.C7.Asset2.Email_amw8qt.png",    alt: "C7 Asset 07 Email" },
];

// ── Sub-components ────────────────────────────────────────────────

function ColHeader({ label }: { label: string }) {
  return (
    <div style={{
      textAlign: "center", fontWeight: 700, fontSize: 13,
      letterSpacing: "0.08em", color: "#111",
      padding: "8px 14px", border: "1px solid #d1d5db",
      borderRadius: 6, marginBottom: 16, background: "#fff",
    }}>
      {label}
    </div>
  );
}

function AdImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img src={src} alt={alt} loading="lazy" style={{
      display: "block", width: "100%", maxWidth: "100%", height: "auto",
      borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
    }} />
  );
}


function Empty({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, borderRadius: 8, background: "#f3f4f6", color: "#9ca3af", fontSize: 13 }}>
      No {label.toLowerCase()} for this selection
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Page() {
  const campaignOptions = useMemo(
    () => [...new Set(CREATIVES.map((c) => c.campaign))].sort(),
    [],
  );

  const [activeCampaign, setActiveCampaign] = useState<string>("C7");

  const assetNums = useMemo(
    () => [...new Set(CREATIVES.filter((c) => c.campaign === activeCampaign).map((c) => c.assetNum))].sort(),
    [activeCampaign],
  );

  const [activeAsset, setActiveAsset] = useState<string>("06");

  // Keep activeAsset valid when campaign changes
  useEffect(() => {
    if (!assetNums.includes(activeAsset)) setActiveAsset(assetNums[0] ?? "01");
  }, [activeCampaign, assetNums, activeAsset]);

  const filtered = CREATIVES.filter(
    (c) => c.campaign === activeCampaign && c.assetNum === activeAsset,
  );
  const socials  = filtered.filter((c) => c.type === "Social");
  const emails   = filtered.filter((c) => c.type === "Email");
  const displays = filtered.filter((c) => c.type === "Display");

  return (
    <div style={{ position: "fixed", top: 0, left: "12rem", right: 0, bottom: 0, display: "flex", flexDirection: "column", background: "#f9fafb", zIndex: 1 }}>
      <div style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
        <DashboardHeader hideDateRange />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 28px 28px", maxWidth: 1440, width: "100%" }}>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center mb-5">
          <MultiSelectDropdown
            label="Campaign"
            value={[activeCampaign]}
            onChange={(vals) => {
              const next = vals.find((v) => v !== activeCampaign);
              if (next) setActiveCampaign(next);
              else if (vals.length === 0) setActiveCampaign(campaignOptions[0]);
            }}
            options={campaignOptions}
            minWidth={140}
            hideSelectAll
          />
          <MultiSelectDropdown
            label="Asset #"
            value={[`Asset ${activeAsset}`]}
            onChange={(vals) => {
              const next = vals.find((v) => v !== `Asset ${activeAsset}`);
              if (next) setActiveAsset(next.replace("Asset ", ""));
              else if (vals.length === 0) setActiveAsset(assetNums[0]);
            }}
            options={assetNums.map((n) => `Asset ${n}`)}
            minWidth={130}
            hideSelectAll
          />
        </div>

        {/* 3-column grid — minmax(0,1fr) so columns shrink on zoom */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: 28, alignItems: "start" }}>

          {/* Social — full column width, height auto, no max-width cap */}
          <div>
            <ColHeader label="SOCIAL MEDIA" />
            {socials.length === 0 ? (
              <Empty label="Social" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {socials.map((a, i) => (
                  <AdImg key={i} src={a.src} alt={a.alt} />
                ))}
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <ColHeader label="EMAIL" />
            {emails.length === 0 ? (
              <Empty label="Email" />
            ) : (
              <AdImg src={emails[0].src} alt={emails[0].alt} />
            )}
          </div>

          {/* Display */}
          <div>
            <ColHeader label="DIGITAL DISPLAY" />
            {displays.length === 0 ? (
              <Empty label="Display" />
            ) : displays.length === 1 ? (
              <AdImg src={displays[0].src} alt={displays[0].alt} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {displays.slice(0, -1).map((a, i) => (
                  <AdImg key={i} src={a.src} alt={a.alt} />
                ))}
                <div style={{ gridColumn: "1 / -1" }}>
                  <AdImg src={displays[displays.length - 1].src} alt={displays[displays.length - 1].alt} />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
