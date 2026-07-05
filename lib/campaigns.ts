/** Ordered newest → oldest. */
export const CAMPAIGNS = [
  "C7: July 2026 - June 2027",
  "C6: April - May 2026",
  "C5: Nov 2025 - May 2026",
  "C4: Aug - Sept 2025",
  "C3: June 2025",
  "C2: May - June 2025",
  "C1: April - May 2025",
] as const;

// C6 is the most recently completed campaign — C7 only started July 1st and has minimal data.
export const DEFAULT_CAMPAIGN = "C6: April - May 2026";

/** Strips the "C#: " prefix to get a display-friendly date range. */
export function campaignDateRange(campaign: string): string {
  return campaign.replace(/^C\d+:\s*/, "");
}
