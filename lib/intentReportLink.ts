// Builds the Intent Report deep-link URL used by every dashboard that
// drills a district row through to /intent-report. Campaign is passed
// through as a short code ("C7") so Intent Report's default filter
// lands on the correct campaign (its own fallback is "C7", which was
// the original source of the "clicked row shows empty" bug on Engaged
// Users). Pass "" (or null/undefined) to omit a param.
export function buildIntentReportHref(
  district?: string | null,
  domain?: string | null,
  campaign?: string | null,
): string {
  const params = new URLSearchParams();
  if (district) params.set("district", district);
  if (domain)   params.set("domain",   domain);
  const campCode = campaign ? String(campaign).split(":")[0].trim() : "";
  if (campCode) params.set("campaign", campCode);
  const qs = params.toString();
  return qs ? `/intent-report?${qs}` : "/intent-report";
}
