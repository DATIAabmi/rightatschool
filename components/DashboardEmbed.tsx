"use client";

import { InteractiveDashboard } from "@metabase/embedding-sdk-react";
import { useEffect, useRef, useState } from "react";
import { useFilter } from "./FilterContext";

interface Props {
  dashboardId: number;
  /** Pass the dashboard's date parameter slug to enable global date filtering. */
  dateParamSlug?: string;
  /** Any extra parameters to pass (e.g. district pre-filter). */
  extraParameters?: Record<string, string>;
  /**
   * When true, the outer container uses height:100% instead of the default
   * calc(100vh-4rem) -m-8. Use this when the parent controls the height via flex.
   */
  fill?: boolean;
  /**
   * Exact tab label to auto-select after the dashboard renders.
   * When set, the built-in Metabase branding header (rows 0-5) is also
   * automatically hidden since our app already shows DashboardHeader.
   */
  autoTab?: string;
  /**
   * Column header name whose data cells should be styled as a clickable link
   * (blue, underlined, pointer cursor) to hint users they can drill through.
   */
  linkColumn?: string;
  /**
   * Column whose numeric value determines row background colour.
   * Negative values → red, zero or positive → green.
   */
  rowColorColumn?: string;
  /**
   * When true, hides the Metabase branding header and keeps the embed hidden
   * until the header is confirmed gone. Use on dashboards without autoTab that
   * still embed the "ABMi Always On" header section.
   */
  hideHeader?: boolean;
  /**
   * When true, dynamically scales the Metabase table so all columns fit the
   * container width without horizontal scrolling.
   */
  compact?: boolean;
  /**
   * Called when the user clicks a cell in the linkColumn.
   * Receives the cell's text value (e.g. the district name).
   * When provided, the click is intercepted (no Metabase drill-through).
   */
  onLinkClick?: (value: string) => void;
  /**
   * Dashboard parameter slug for the ABMi Campaign filter.
   * When provided, the global campaign selection from FilterContext is sent
   * to the embed (e.g. "abmi_campaign_" for dashboard 76).
   */
  campaignParamSlug?: string;
  /**
   * When true, stretches table columns to fill the full container width
   * instead of using their natural column widths.
   */
  stretchColumns?: boolean;
}

// ---------------------------------------------------------------------------
// Hide the Metabase dashboard's own branding header (rows 0-5).
// Strategy: find the "ABMi Always On" text card, walk up to its dashcard
// container, then hide every sibling in the parent grid whose bottom edge
// is at or near the header section (with a 150px buffer for the row-5 divider).
// ---------------------------------------------------------------------------
// Hides Metabase's branding header rows and closes the resulting whitespace gap.
//
// Idempotent — safe to call on every tick:
// • pivot visible  → hide header cards, measure gap, apply grid transform
// • pivot hidden   → skip re-hiding, re-check gap (in case of re-render)
// • no content yet → return false so the caller retries
// • gap already correct → return true immediately (fast path)
//
// Uses transform on the GRID ELEMENT rather than modifying each card's
// top/left/transform, because newer react-grid-layout versions position cards
// via `transform: translate(x, y)` — our top-based regex would never match.
// The grid element's own transform is not managed by react-grid-layout, so it
// survives child re-renders.
// Known text found only in the Metabase branding header rows.
// These strings identify which grid children are header cards.
const HEADER_CARD_TEXTS = [
  "abmi always on",
  "last updated",
  "reporting period",
  "program status",
  "date filter",
  "datia",         // DATIA K12 logo card
  "right at school", // Right at School logo card (if it has alt/title text)
];

// Cards that are not branding headers but produce large whitespace gaps
// because their dashboard layout height far exceeds their content.
// Identified by a distinctive substring of their text content.
const SKIP_CONTENT_TEXTS = [
  "sbm - school board minutes. the sbm link", // instruction card on Engaged Users tab
];

// Returns true if a grid child is a branding header card.
// Catches both text-identified cards and image-only logo cards (DATIA K12, Right at School).
function isHeaderGridCard(child: HTMLElement): boolean {
  const text = (child.textContent ?? "").toLowerCase().trim();
  if (HEADER_CARD_TEXTS.some((h) => text.includes(h))) return true;
  // Image-only card (logo with no visible text) — catches DATIA K12, Right at School
  if (text.length < 5 && child.querySelector("img") !== null) return true;
  return false;
}

// Returns true if a grid child should be hidden to eliminate whitespace
// even though it is not a branding header.
function isSkipContentCard(child: HTMLElement): boolean {
  const text = (child.textContent ?? "").toLowerCase().trim();
  return SKIP_CONTENT_TEXTS.some((s) => text.includes(s));
}

function hideMetabaseHeaderCards(container: HTMLElement): boolean {
  // 1. Find the react-grid-layout grid via "ABMi Always On" text card.
  let gridEl: HTMLElement | null = null;
  for (const el of container.querySelectorAll<HTMLElement>("*")) {
    if (el.childElementCount > 4) continue;
    if ((el.textContent ?? "").trim() !== "ABMi Always On") continue;
    let ancestor: HTMLElement | null = el;
    while (ancestor && ancestor !== container) {
      if (
        getComputedStyle(ancestor).position === "absolute" &&
        ancestor.parentElement
      ) {
        gridEl = ancestor.parentElement as HTMLElement;
        break;
      }
      ancestor = ancestor.parentElement as HTMLElement | null;
    }
    break;
  }
  if (!gridEl) return false;

  const children = Array.from(gridEl.children) as HTMLElement[];
  const gridRect = gridEl.getBoundingClientRect();

  // 2. Find the bottom of all VISIBLE text-identified header cards.
  //    display:none cards have height=0 — they're skipped here.
  let headerBottom = 0;
  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (rect.height === 0) continue;
    const text = (child.textContent ?? "").toLowerCase();
    if (HEADER_CARD_TEXTS.some((h) => text.includes(h))) {
      if (rect.bottom > headerBottom) headerBottom = rect.bottom;
    }
  }

  // 3. When headerBottom === 0, all text-identified header cards are already
  //    hidden. Fall back to the stored contentStart to re-apply the transform
  //    and re-hide any header card whose display:none was inadvertently reset.
  if (headerBottom === 0) {
    const stored = gridEl.dataset.contentStart
      ? parseFloat(gridEl.dataset.contentStart)
      : 0;
    if (stored <= 0) return false; // not yet initialised

    for (const child of children) {
      if (
        child.getBoundingClientRect().height > 0 &&
        (isHeaderGridCard(child) || isSkipContentCard(child))
      ) {
        child.style.setProperty("display", "none", "important");
      }
    }
    const m = (gridEl.style.transform ?? "").match(/translateY\(-(\d+\.?\d*)px\)/);
    if (!m || Math.abs(parseFloat(m[1]) - stored) >= 2) {
      gridEl.style.setProperty("transform", `translateY(-${stored}px)`, "important");
    }
    return true;
  }

  // 4. Hide every grid child that belongs to the header section.
  //    +30 px catches cards in the same row but with slightly different tops.
  //    +120 px (image-only) catches the DATIA K12 / Right at School logo cards
  //    that sit in a row BELOW the last text-identified header card.
  const textThreshold = headerBottom + 30;
  const logoThreshold = headerBottom + 120;
  let contentStart = Infinity;

  for (const child of children) {
    const rect = child.getBoundingClientRect();
    if (rect.height === 0) continue;

    const imgOnly =
      (child.textContent ?? "").trim().length < 5 &&
      child.querySelector("img") !== null;

    if (
      rect.top < textThreshold ||
      (imgOnly && rect.top < logoThreshold) ||
      isSkipContentCard(child)
    ) {
      child.style.setProperty("display", "none", "important");
    } else {
      const relTop = rect.top - gridRect.top;
      if (relTop < contentStart) contentStart = relTop;
    }
  }

  if (contentStart === Infinity || contentStart <= 2) return true;

  // 5. Translate the grid up and store contentStart for future maintenance calls.
  gridEl.dataset.contentStart = String(contentStart);
  gridEl.style.setProperty(
    "transform",
    `translateY(-${contentStart}px)`,
    "important"
  );
  return true;
}

export default function DashboardEmbed({
  dashboardId,
  dateParamSlug,
  extraParameters,
  fill,
  autoTab,
  linkColumn,
  rowColorColumn,
  hideHeader,
  compact,
  onLinkClick,
  campaignParamSlug,
  stretchColumns,
}: Props) {
  const { metabaseDateRange, campaign } = useFilter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabClicked, setTabClicked] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);
  // Keep a stable ref so the fix() closure never goes stale.
  const onLinkClickRef = useRef(onLinkClick);
  useEffect(() => { onLinkClickRef.current = onLinkClick; });

  const initialParameters = {
    ...(extraParameters ?? {}),
    ...(dateParamSlug && metabaseDateRange
      ? { [dateParamSlug]: metabaseDateRange }
      : {}),
    ...(campaignParamSlug && campaign
      ? { [campaignParamSlug]: campaign }
      : {}),
  };

  // ── Auto-click the named tab, then wait for content to finish loading ────
  useEffect(() => {
    if (!autoTab) return;
    setTabClicked(false);

    const container = containerRef.current;
    if (!container) return;

    let clickedAt = 0; // timestamp of the tab click; 0 = not yet clicked
    let done = false;

    const isLoading = () =>
      container.querySelectorAll(
        '[data-testid="loading-indicator"], ' +
        '[class*="LoadingSpinner"], [class*="loading-spinner"], ' +
        '[class*="Spinner"], [class*="spinner"], ' +
        // Metabase skeleton cards while data fetches
        '[class*="Skeleton"], [class*="skeleton"]'
      ).length > 0;

    const tick = () => {
      if (done) return;

      // Step 1 — find and click the tab button
      if (clickedAt === 0) {
        const candidates = container.querySelectorAll<HTMLElement>(
          '[role="tab"], nav button, nav a, ' +
          '[class*="tab"] button, [class*="Tab"] button'
        );
        for (const el of candidates) {
          if (el.textContent?.trim() === autoTab) {
            el.click();
            clickedAt = Date.now();
            break;
          }
        }
        return; // wait for next tick before checking load state
      }

      // Step 2 — wait for the content to finish loading
      const elapsed = Date.now() - clickedAt;

      // Hard timeout: show regardless after 10 s
      if (elapsed >= 10_000) {
        done = true;
        setTabClicked(true);
        return;
      }

      // Minimum 1.5 s wait after click + no active loading indicators
      if (elapsed >= 1500 && !isLoading()) {
        done = true;
        setTabClicked(true);
      }
    };

    const observer = new MutationObserver(tick);
    observer.observe(container, { childList: true, subtree: true });

    const interval = setInterval(tick, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [autoTab, dashboardId]);

  // ── Hide Metabase's branding header; reveal embed only after it's clean ─────
  useEffect(() => {
    // Run when: (a) autoTab dashboard after tab loads, or (b) hideHeader dashboard immediately.
    if (!autoTab && !hideHeader) return;
    if (autoTab && !tabClicked) return;
    const container = containerRef.current;
    if (!container) return;

    setHeaderReady(false);

    const tryHide = () => {
      const ok = hideMetabaseHeaderCards(container);
      if (ok) setHeaderReady(true);
      return ok;
    };

    const start = Date.now();
    const interval = setInterval(() => {
      tryHide();
      // Safety fallback: reveal after 5 s so we never get permanently stuck.
      if (Date.now() - start > 5_000) setHeaderReady(true);
      // Keep re-applying for 30 s in case react-grid-layout re-renders.
      if (Date.now() - start > 30_000) clearInterval(interval);
    }, 200);

    const observer = new MutationObserver(() => tryHide());
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [autoTab, tabClicked, hideHeader, dashboardId]);

  // ── Fix column headers (full text, no truncation) ────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fix = () => {
      // Hide Metabase title + tab bar (all known selectors)
      container
        .querySelectorAll<HTMLElement>(
          '[role="tablist"], ' +
          '[data-testid="dashboard-name-heading"], ' +
          '[data-testid="dashboard-tabs"], ' +
          '[class*="DashboardTabs"], ' +
          '[class*="TabsContainer"], ' +
          '[class*="dashboardTabs"], ' +
          '[class*="DashboardTab__"]'
        )
        .forEach((el) =>
          el.style.setProperty("display", "none", "important")
        );

      // Column headers: remove truncation, center text
      container
        .querySelectorAll<HTMLElement>(
          '[role="columnheader"], [role="columnheader"] *'
        )
        .forEach((el) => {
          el.style.setProperty("white-space", "normal", "important");
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("text-overflow", "clip", "important");
          el.style.setProperty("height", "auto", "important");
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("word-break", "break-word", "important");
          el.style.setProperty("line-height", "1.3", "important");
          el.style.setProperty("padding-top", "6px", "important");
          el.style.setProperty("padding-bottom", "6px", "important");
          el.style.setProperty("text-align", "center", "important");
          el.style.setProperty("justify-content", "center", "important");
        });

      // Center all data cells
      container
        .querySelectorAll<HTMLElement>('[role="gridcell"], [role="gridcell"] > *, td, td > *')
        .forEach((el) => {
          el.style.setProperty("text-align", "center", "important");
          el.style.setProperty("justify-content", "center", "important");
        });

      // Style the named link column as a clickable hyperlink
      if (linkColumn) {
        // Find column index by matching the header text
        const headerCells = Array.from(
          container.querySelectorAll<HTMLElement>('[role="columnheader"]')
        );
        const colIdx = headerCells.findIndex((h) =>
          (h.textContent ?? "").trim().toLowerCase() === linkColumn.toLowerCase()
        );

        if (colIdx >= 0) {
          container
            .querySelectorAll<HTMLElement>('[role="row"]')
            .forEach((row) => {
              const cells = row.querySelectorAll<HTMLElement>('[role="gridcell"]');
              const cell = cells[colIdx];
              if (cell) {
                cell.style.setProperty("color", "#2563eb", "important");
                cell.style.setProperty("text-decoration", "underline", "important");
                cell.style.setProperty("cursor", "pointer", "important");
                cell.style.setProperty("font-weight", "600", "important");
                // Register click handler once per cell. When onLinkClick is
                // provided we intercept the click so Metabase drill-through
                // doesn't fire; the parent handles the action instead.
                if (!cell.dataset.linkHandled) {
                  cell.dataset.linkHandled = "1";
                  cell.addEventListener("click", (e) => {
                    const handler = onLinkClickRef.current;
                    if (handler) {
                      e.stopPropagation();
                      const value = (cell.textContent ?? "").trim();
                      if (value) handler(value);
                    }
                  });
                }
              }
            });
        }
      }

      // Colour rows based on the sign of a numeric column's value.
      // Uses data-colored guard so already-processed rows are skipped.
      if (rowColorColumn) {
        const headers = Array.from(
          container.querySelectorAll<HTMLElement>('[role="columnheader"]')
        );
        const colIdx = headers.findIndex(
          (h) =>
            (h.textContent ?? "").trim().toLowerCase() ===
            rowColorColumn.toLowerCase()
        );

        if (colIdx >= 0) {
          container
            .querySelectorAll<HTMLElement>('[role="row"]')
            .forEach((row) => {
              if (row.dataset.colored) return; // already processed
              const cells = row.querySelectorAll<HTMLElement>('[role="gridcell"]');
              const cell = cells[colIdx];
              if (!cell) return;
              const val = parseFloat(
                (cell.textContent ?? "").replace(/,/g, "").trim()
              );
              if (isNaN(val)) return;
              row.style.setProperty(
                "background-color",
                val < 0 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                "important"
              );
              row.dataset.colored = "1";
            });
        }
      }

      container
        .querySelectorAll<HTMLElement>(
          '[role="rowgroup"]:first-of-type [role="row"], ' +
            '[role="grid"] > div:first-child [role="row"]'
        )
        .forEach((el) => {
          el.style.setProperty("height", "auto", "important");
          el.style.setProperty("min-height", "44px", "important");
        });

      // Fill the FULL available space — both width and height — with zero dead space.
      if (stretchColumns) {
        const availW = container.clientWidth;
        const availH = container.clientHeight;

        if (availW > 0 && availH > 0) {
          const gridLayout = container.querySelector<HTMLElement>(".react-grid-layout");
          if (gridLayout) {
            // ── Width ──────────────────────────────────────────────────────
            gridLayout.style.setProperty("width", `${availW}px`, "important");

            // ── Height ─────────────────────────────────────────────────────
            const allCards = Array.from(gridLayout.children) as HTMLElement[];
            const visibleCards = allCards.filter(
              (c) => getComputedStyle(c).display !== "none"
            );
            // A card is a "real" branding header only if it has no data grid
            // inside it. Content cards (tables) may contain "right at school"
            // in their title but are NOT header cards.
            const anyHeaderStillVisible = visibleCards.some(
              (c) => isHeaderGridCard(c) && !c.querySelector('[role="grid"], table, [role="table"]')
            );

            if (visibleCards.length > 0 && !anyHeaderStillVisible) {
              // Capture original layout positions exactly once so repeated fix()
              // calls use consistent base values rather than already-scaled ones.
              for (const card of visibleCards) {
                if (!card.dataset.origTop) {
                  card.dataset.origTop = String(card.offsetTop);
                  card.dataset.origH   = String(card.offsetHeight);
                }
              }

              const origTops = visibleCards.map((c) => parseFloat(c.dataset.origTop!));
              const origHs   = visibleCards.map((c) => parseFloat(c.dataset.origH!));
              const minTop   = Math.min(...origTops);
              const maxBtm   = Math.max(...origTops.map((t, i) => t + origHs[i]));
              const naturalH = maxBtm - minTop;

              if (naturalH > 4) {
                const scaleH = availH / naturalH;
                // Grid must be tall enough to contain all repositioned cards.
                gridLayout.style.setProperty("height", `${minTop + availH}px`, "important");

                visibleCards.forEach((card, i) => {
                  // newTop keeps the cards stacked in the same relative order,
                  // scaled so the last card's bottom lands exactly at availH.
                  const newTop = minTop + (origTops[i] - minTop) * scaleH;
                  const newH   = origHs[i] * scaleH;
                  card.style.setProperty("top",    `${newTop}px`, "important");
                  card.style.setProperty("height", `${newH}px`,   "important");
                  card.style.setProperty("width",  `${availW}px`, "important");
                  card.style.setProperty("left",   "0",           "important");
                });
              }
            } else {
              // Header not yet hidden — just do width for now.
              visibleCards.forEach((card) => {
                card.style.setProperty("width", `${availW}px`, "important");
                card.style.setProperty("left",  "0",           "important");
              });
            }

            // Make the Metabase table grid fill its dashcard horizontally.
            container.querySelectorAll<HTMLElement>('[role="grid"]').forEach((g) => {
              g.style.setProperty("width",     "100%", "important");
              g.style.setProperty("min-width", "0",    "important");
            });
          }
        }
      }

      // Scale the table so all columns fit the container without horizontal scrolling.
      if (compact) {
        // Hide Metabase's filter-parameter bar — district is pre-populated via URL
        // so the interactive filter chips just take up space the table could use.
        container
          .querySelectorAll<HTMLElement>(
            '[data-testid="dashboard-parameters-widget-container"], ' +
            '[class*="ParametersWidget"], ' +
            '[class*="ParameterWidget"], ' +
            '[class*="DashboardParameterList"], ' +
            '[class*="DashboardFilterList"]'
          )
          .forEach((el) => el.style.setProperty("display", "none", "important"));

        const grid = container.querySelector<HTMLElement>('[role="grid"]');
        if (grid) {
          // [role="grid"] typically has overflow:hidden, so its scrollWidth only
          // reflects the clipped visible width — not the full column span.
          // Walk up to the nearest overflow-x:auto/scroll ancestor (the real
          // scrollable container) so we measure and zoom the right element.
          let scrollEl: HTMLElement = grid;
          let anc = grid.parentElement;
          while (anc && anc !== container) {
            const ovf = getComputedStyle(anc).overflowX;
            if (ovf === "auto" || ovf === "scroll" || ovf === "overlay") {
              scrollEl = anc;
              break;
            }
            anc = anc.parentElement;
          }

          // Reset prior overrides so measurements reflect natural dimensions.
          scrollEl.style.removeProperty("zoom");
          scrollEl.style.removeProperty("height");
          scrollEl.style.removeProperty("overflow-x");

          const naturalWidth = scrollEl.scrollWidth;
          const naturalHeight = scrollEl.offsetHeight;
          const available = container.clientWidth;

          if (naturalWidth > available + 4) {
            const zoom = Math.max(0.4, available / naturalWidth);
            scrollEl.style.setProperty("zoom", String(zoom));
            // zoom shrinks layout height too; restore natural px height so
            // the table fills its card with no gap below.
            if (naturalHeight > 0) {
              scrollEl.style.setProperty(
                "height",
                `${naturalHeight / zoom}px`,
                "important"
              );
            }
            // Belt-and-suspenders: suppress scrollbar even if measurement is off by a px.
            scrollEl.style.setProperty("overflow-x", "hidden", "important");
          }
        }
      }
    };

    // Watch only for new elements (childList), NOT attribute changes.
    // fix() modifies inline styles, so observing attributes would re-fire
    // the observer on every style change → infinite loop.
    const observer = new MutationObserver(fix);
    observer.observe(container, { childList: true, subtree: true });

    let ticks = 0;
    const interval = setInterval(() => {
      fix();
      if (++ticks >= 30) clearInterval(interval); // run for ~12 s
    }, 400);

    fix();
    return () => { observer.disconnect(); clearInterval(interval); };
  }, [dashboardId, compact, stretchColumns]);

  const outerClass = fill ? "" : "h-[calc(100vh-4rem)] -m-8";
  // Keep embed hidden until the header is confirmed removed.
  // autoTab embeds also wait for the tab click + load to complete.
  const needsHeaderGate = !!(autoTab || hideHeader);
  const visibility =
    needsHeaderGate && (!tabClicked || !headerReady) ? "hidden" : "visible";

  return (
    <div
      className={outerClass}
      style={{ height: fill ? "100%" : undefined, overflow: "hidden" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');

        /* Hide Metabase title + tab bar — our sidebar handles navigation */
        .mb-embed [role="tablist"],
        .mb-embed [data-testid="dashboard-name-heading"],
        .mb-embed [data-testid="dashboard-tabs"],
        .mb-embed [class*="DashboardTabs"],
        .mb-embed [class*="TabsContainer"],
        .mb-embed [class*="dashboardTabs"],
        .mb-embed [class*="DashboardTab__"] {
          display: none !important;
        }
        /* Column headers: always show full text, centered, Lato 12 px */
        .mb-embed [role="columnheader"],
        .mb-embed [role="columnheader"] * {
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          height: auto !important;
          max-height: none !important;
          word-break: break-word !important;
          line-height: 1.3 !important;
          text-align: center !important;
          justify-content: center !important;
          font-family: 'Lato', sans-serif !important;
          font-size: 12px !important;
        }
        /* Header row itself must also be auto-height so wrapped text isn't clipped */
        .mb-embed [role="rowgroup"]:first-of-type [role="row"] {
          height: auto !important;
          min-height: 36px !important;
        }

        /* Table data cells — Lato 14 px, centered */
        .mb-embed [role="gridcell"],
        .mb-embed [role="gridcell"] > *,
        .mb-embed td,
        .mb-embed td > * {
          text-align: center !important;
          justify-content: center !important;
          font-family: 'Lato', sans-serif !important;
          font-size: 14px !important;
        }

        /* stretchColumns: let JS control exact pixel widths/heights on grid + cards */
        .mb-embed-stretch .react-grid-layout {
          overflow: visible !important;
        }

        /* ── stretchColumns: make all table columns fill the full container ── */
        .mb-embed-stretch [role="grid"] {
          width: 100% !important;
          min-width: 100% !important;
        }
        .mb-embed-stretch [role="rowgroup"] > [role="row"] {
          width: 100% !important;
          min-width: 0 !important;
        }
        .mb-embed-stretch [role="columnheader"],
        .mb-embed-stretch [role="gridcell"] {
          flex: 1 1 0 !important;
          width: auto !important;
          min-width: 50px !important;
          max-width: none !important;
        }


        /* Scalar (big number) cards: reduce font so the full value fits */
        .mb-embed [data-testid="scalar-value"],
        .mb-embed [class*="ScalarValue"],
        .mb-embed [class*="scalar-value"],
        .mb-embed [class*="ScalarWrapper"] h1,
        .mb-embed [class*="ScalarWrapper"] h2 {
          font-size: 2rem !important;
          line-height: 1.2 !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`mb-embed${stretchColumns ? " mb-embed-stretch" : ""}`}
        style={{ height: "100%", visibility }}
      >
        <InteractiveDashboard
          key={JSON.stringify(initialParameters)}
          dashboardId={dashboardId}
          initialParameters={initialParameters}
          withTitle={false}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
