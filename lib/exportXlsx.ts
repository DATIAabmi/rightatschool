import { friendlyName } from "@/lib/exportCsv";

type Col = { display_name: string };
type Cell = string | number | null | undefined;

export type XlsxColFmt = { w: number; h: "left" | "center"; date?: boolean };

const L = "left" as const;
const C = "center" as const;

// Per-tab column specs (width in Excel characters, alignment; every cell wraps)
export const XLSX_FORMATS = {
  ecosystem: [{ w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }],
  engagedUsers: [
    { w: 50, h: L }, { w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C },
    { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }, { w: 12, h: C },
  ],
  accountIntelligence: [
    { w: 50, h: L }, { w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 25, h: L }, { w: 25, h: L },
    { w: 15, h: L, date: true }, { w: 20, h: L }, { w: 20, h: L }, { w: 8, h: C }, { w: 40, h: L },
    { w: 40, h: L }, { w: 10, h: L },
  ],
  persona: [{ w: 50, h: L }, { w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 40, h: L }, { w: 10, h: C }, { w: 10, h: C }],
  geo: [{ w: 15, h: C }, { w: 15, h: C }, { w: 15, h: C }, { w: 15, h: C }],
  leads: [{ w: 50, h: L }, { w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 40, h: L }, { w: 16, h: C }],
  topic: [
    { w: 50, h: L }, { w: 30, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 15, h: L, date: true },
    { w: 40, h: L }, { w: 10, h: C },
  ],
  content: [{ w: 60, h: L }, { w: 40, h: L }, { w: 40, h: L }, { w: 40, h: L }, { w: 10, h: C }, { w: 10, h: C }, { w: 10, h: C }],
} satisfies Record<string, XlsxColFmt[]>;

// Excel stores column width with 5px of cell padding (Calibri 11 = 7px per
// character). Without it, a width of 50 shows as 49.29 in Excel's Column Width.
export function excelWidth(chars: number): number {
  return Math.trunc(((chars * 7 + 5) / 7) * 256) / 256;
}

// Accepts "YYYY-MM-DD…" (ISO) or "MM-DD-YY" (Metabase-formatted) strings
function toDate(v: Cell): Date | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(2000 + +m[3], +m[1] - 1, +m[2]));
  return null;
}

// Numbers that arrive as text ("1,234", "1.15%") are written as real numbers
// so Excel doesn't flag them with the number-stored-as-text warning.
function toCell(v: Cell, fmt?: XlsxColFmt): { value: string | number | Date | null; numFmt?: string } {
  if (v === null || v === undefined || v === "") return { value: null };
  if (fmt?.date) {
    const d = toDate(v);
    if (d) return { value: d, numFmt: "mm-dd-yy" };
  }
  if (typeof v === "number") return { value: v, numFmt: Number.isInteger(v) ? "#,##0" : undefined };
  const s = v.trim();
  const pct = s.match(/^-?(0|[1-9]\d*)(\.(\d+))?%$/);
  if (pct) return { value: parseFloat(s) / 100, numFmt: pct[3] ? `0.${"0".repeat(pct[3].length)}%` : "0%" };
  if (/^-?(0|[1-9]\d{0,2}(,\d{3})+|[1-9]\d*)(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ""));
    return { value: n, numFmt: Number.isInteger(n) ? "#,##0" : undefined };
  }
  return { value: s };
}

function exportHeader(name: string): string {
  const h = friendlyName(name);
  // Market-neutral label, matching the Export All workbook
  return h === "District" ? "Organization" : h;
}

/**
 * Download a single-sheet .xlsx. `rows` is the full grid (row 1 included);
 * `boldRows` are 1-based row numbers to bold.
 */
export async function exportGridToXlsx(
  filename: string,
  sheetName: string,
  rows: Cell[][],
  cols: XlsxColFmt[],
  opts: { headerHeight?: number; boldRows?: number[] } = {},
) {
  try {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "DATIA ABMxi";
    const ws = wb.addWorksheet(sheetName.slice(0, 31));

    // Set column widths before adding rows — ws.columns is more reliable than
    // col.width in the ExcelJS browser bundle.
    ws.columns = cols.map((fmt) => ({ width: excelWidth(fmt.w) }));

    rows.forEach((row, i) => {
      const r = ws.getRow(i + 1);
      row.forEach((v, j) => {
        const cell = r.getCell(j + 1);
        const { value, numFmt } = i === 0 ? { value: v ?? null } : toCell(v, cols[j]);
        cell.value = value;
        if (numFmt) cell.numFmt = numFmt;
      });
    });

    cols.forEach((fmt, j) => {
      ws.getColumn(j + 1).eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: fmt.h, vertical: "top", wrapText: true };
      });
    });

    if (opts.headerHeight) ws.getRow(1).height = opts.headerHeight;
    for (const n of opts.boldRows ?? [1]) ws.getRow(n).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Excel export failed", err);
  }
}

/** Download a table (header row + data rows) as a formatted single-sheet .xlsx. */
export function exportToXlsx(
  filename: string,
  sheetName: string,
  cols: Col[],
  rows: Cell[][],
  fmt: XlsxColFmt[],
  opts: { headerHeight?: number } = { headerHeight: 30 },
) {
  return exportGridToXlsx(filename, sheetName, [cols.map((c) => exportHeader(c.display_name)), ...rows], fmt, opts);
}
