"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_CAMPAIGN } from "@/lib/campaigns";

interface FilterState {
  dateStart: string;
  dateEnd: string;
  setDateStart: (d: string) => void;
  setDateEnd: (d: string) => void;
  /** "YYYY-MM-DD~YYYY-MM-DD" ready for Metabase, undefined if either date is unset */
  metabaseDateRange: string | undefined;
  /** Selected ABMi campaign keys, e.g. ["C5: Nov 2025 - May 2026"]. Empty = all campaigns. */
  campaign: string[];
  setCampaign: (c: string[]) => void;
  /** District search values — passed as the Metabase district parameter. Empty = all districts. */
  district: string[];
  setDistrict: (d: string[]) => void;
}

const FilterContext = createContext<FilterState>({
  dateStart: "",
  dateEnd: "",
  setDateStart: () => {},
  setDateEnd: () => {},
  metabaseDateRange: undefined,
  campaign: [],
  setCampaign: () => {},
  district: [],
  setDistrict: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [campaign, setCampaign] = useState<string[]>([DEFAULT_CAMPAIGN]);
  const [district, setDistrict] = useState<string[]>([]);

  const metabaseDateRange =
    dateStart && dateEnd ? `${dateStart}~${dateEnd}` : undefined;

  return (
    <FilterContext.Provider
      value={{ dateStart, dateEnd, setDateStart, setDateEnd, metabaseDateRange, campaign, setCampaign, district, setDistrict }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
