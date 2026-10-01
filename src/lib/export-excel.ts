import ExcelJS from "exceljs";

import type { ExpenseWithCategory } from "@/lib/expenses";

/**
 * This file controls the DESIGN of the exported Excel workbook:
 *
 *   Sheet "Summary"              – spending by main category → category, with
 *                                  counts, amounts and share of the total
 *   Sheet "Detail by category"   – every transaction grouped main category →
 *                                  category, with subtotals. Uses Excel outline
 *                                  grouping, so the [1][2][3] buttons collapse it
 *   Sheet "Transactions"         – flat chronological ledger with filters; its
 *                                  total follows the active filter
 *
 * Every transaction gets a reference number (No.) in date order, the same on
 * every sheet, so a line on one sheet can be found on another.
 *
 * Edit freely — nothing else in the app depends on the layout below.
 */

export interface ExportOptions {
  /** Human label for the period, e.g. "September 2026". Goes in the file properties. */
  periodLabel: string;
  /** Filename-safe label, e.g. "2026-09". */
  fileLabel: string;
  /** Active filters (currently not shown in the workbook). */
  filters?: { mainCategory?: string; category?: string };
}

/* ── Palette & formats ─────────────────────────────────────────────────── */

const NAVY = "FF1F3864"; // title band, table headers, grand totals
const BLUE = "FF2F5597"; // section headings, category names
const BAND = "FFD9E1F2"; // main category rows
const BAND_SOFT = "FFEEF3FA"; // category header rows
const ZEBRA = "FFF7F9FC"; // alternate transaction rows
const TOTAL_FILL = "FFF2F2F2";
const RULE = "FFD9D9D9"; // row separators
const TEXT = "FF262626";
const MUTED = "FF7F7F7F";
const WHITE = "FFFFFFFF";

const CURRENCY = '#,##0.00 "€";-#,##0.00 "€";"–"';
const PERCENT = "0.0%";
const INTEGER = "#,##0";
const REF = "000";
const DATE = "dd mmm yyyy";

const FONT = "Calibri";

const rule: Partial<ExcelJS.Border> = { style: "thin", color: { argb: RULE } };
const navyThin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: NAVY } };
const navyMedium: Partial<ExcelJS.Border> = { style: "medium", color: { argb: NAVY } };
const navyDouble: Partial<ExcelJS.Border> = { style: "double", color: { argb: NAVY } };

/* ── Helpers ───────────────────────────────────────────────────────────── */

/**
 * A formula cell with its value pre-computed. Excel recalculates on open, but
 * LibreOffice/Numbers/previews show the cached result — without it they show 0.
 */
function f(formula: string, result: number): ExcelJS.CellFormulaValue {
  return { formula, result };
}

/** "YYYY-MM-DD" → Date at UTC midnight, so Excel shows exactly that day in any timezone. */
function toExcelDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 1 → "A", 5 → "E" (sheets here never go past column Z). */
function col(n: number) {
  return String.fromCharCode(64 + n);
}

function font(o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT, size: 10, color: { argb: TEXT }, ...o };
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

type CellStyle = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
};

/** Style columns 1..n of a row (merged and empty cells included, so fills/rules span the table). */
function paint(row: ExcelJS.Row, n: number, style: CellStyle) {
  for (let c = 1; c <= n; c++) {
    const cell = row.getCell(c);
    if (style.font) cell.font = style.font;
    if (style.fill) cell.fill = style.fill;
    if (style.border) cell.border = style.border;
    cell.alignment = { vertical: "middle", ...cell.alignment };
  }
}

function alignRight(cell: ExcelJS.Cell) {
  cell.alignment = { ...cell.alignment, vertical: "middle", horizontal: "right" };
}

function newSheet(wb: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: NAVY }, defaultRowHeight: 18 },
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = widths.map((width) => ({ width }));
  return ws;
}

/**
 * Navy title band, period line and "prepared on / scope" line. Returns the next
 * free row number (after one blank spacer row).
/** Navy table header. Columns from `rightFrom` onward (numbers) are right-aligned. */
function writeTableHeader(ws: ExcelJS.Worksheet, r: number, labels: string[], rightFrom: number) {
  const row = ws.getRow(r);
  row.values = labels;
  row.height = 24;
  paint(row, labels.length, {
    font: font({ bold: true, color: { argb: WHITE } }),
    fill: solid(NAVY),
    border: { top: navyThin, bottom: navyThin },
  });
  labels.forEach((_, i) => {
    const cell = row.getCell(i + 1);
    cell.alignment = {
      vertical: "middle",
      wrapText: true,
      horizontal: i + 1 >= rightFrom ? "right" : "left",
    };
  });
  return r + 1;
}

function styleTotalRow(row: ExcelJS.Row, n: number) {
  row.height = 22;
  paint(row, n, {
    font: font({ bold: true }),
    fill: solid(TOTAL_FILL),
    border: { top: navyThin, bottom: navyDouble },
  });
}

/* ── Data preparation ──────────────────────────────────────────────────── */

type Line = {
  ref: number;
  date: string;
  description: string;
  main: string;
  category: string;
  amount: number;
};

type Group<T> = { name: string; amount: number; count: number; items: T[] };

/** Chronological lines with a stable reference number shared by every sheet. */
function toLines(expenses: ExpenseWithCategory[]): Line[] {
  const sorted = [...expenses].sort((a, b) =>
    a.expense_date === b.expense_date
      ? a.created_at.localeCompare(b.created_at)
      : a.expense_date.localeCompare(b.expense_date),
  );
  return sorted.map((e, i) => ({
    ref: i + 1,
    date: e.expense_date,
    description: e.description?.trim() || "—",
    main: e.category?.main_category?.name ?? "Ungrouped",
    category: e.category?.name ?? "Uncategorized",
    amount: Number(e.amount),
  }));
}

/** Groups keep their items in input order; groups themselves are sorted largest first. */
function groupBy(lines: Line[], key: (l: Line) => string): Group<Line>[] {
  const map = new Map<string, Group<Line>>();
  for (const l of lines) {
    const k = key(l);
    const g = map.get(k) ?? { name: k, amount: 0, count: 0, items: [] };
    g.amount += l.amount;
    g.count += 1;
    g.items.push(l);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/* ── Sheet 1: Summary ──────────────────────────────────────────────────── */

function addSummarySheet(wb: ExcelJS.Workbook, lines: Line[]) {
  // Main category / Category | Transactions | Amount | % of total
  const N = 4;
  const ws = newSheet(wb, "Summary", [38, 14, 18, 12]);

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const mains = groupBy(lines, (l) => l.main);

  let r = writeTableHeader(
    ws,
    1,
    ["Main category / Category", "Transactions", "Amount", "% of total"],
    2,
  );
  const firstBody = r;
  // Row count is known up front so shares can reference the total row
  const totalRow =
    firstBody + mains.reduce((s, m) => s + 1 + groupBy(m.items, (l) => l.category).length, 0);
  const share = (row: number, amount: number) =>
    f(`IF($C$${totalRow}=0,0,C${row}/$C$${totalRow})`, total ? amount / total : 0);
  const numberFormats = (row: ExcelJS.Row) => {
    row.getCell(2).numFmt = INTEGER;
    row.getCell(3).numFmt = CURRENCY;
    row.getCell(4).numFmt = PERCENT;
  };

  for (const m of mains) {
    const cats = groupBy(m.items, (l) => l.category);
    const mr = r++;
    const from = r;
    const to = r + cats.length - 1;

    // SUBTOTAL, so the grand total below can skip these rows and not double count
    const mRow = ws.getRow(mr);
    mRow.values = [
      m.name,
      f(`SUBTOTAL(9,B${from}:B${to})`, m.count),
      f(`SUBTOTAL(9,C${from}:C${to})`, m.amount),
      share(mr, m.amount),
    ];
    numberFormats(mRow);
    paint(mRow, N, {
      font: font({ bold: true, color: { argb: NAVY } }),
      fill: solid(BAND),
      border: { top: navyThin, bottom: rule },
    });
    mRow.height = 20;

    for (const c of cats) {
      const cr = r++;
      const cRow = ws.getRow(cr);
      cRow.values = [c.name, c.count, c.amount, share(cr, c.amount)];
      numberFormats(cRow);
      paint(cRow, N, { font: font(), border: { bottom: rule } });
      cRow.getCell(1).alignment = { vertical: "middle", indent: 2 };
    }
  }

  const tRow = ws.getRow(totalRow);
  tRow.values = [
    "Total",
    f(`SUBTOTAL(9,B${firstBody}:B${totalRow - 1})`, lines.length),
    f(`SUBTOTAL(9,C${firstBody}:C${totalRow - 1})`, total),
    f(`IF(C${totalRow}=0,0,1)`, total ? 1 : 0),
  ];
  numberFormats(tRow);
  styleTotalRow(tRow, N);

  ws.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
}

/* ── Sheet 2: Detail by category ───────────────────────────────────────── */

function addDetailSheet(wb: ExcelJS.Workbook, lines: Line[]) {
  // No. | Date | Description | Amount
  const N = 4;
  const ws = newSheet(wb, "Detail by category", [8, 14, 62, 18]);
  ws.properties.outlineProperties = { summaryBelow: true, summaryRight: false };
  ws.properties.outlineLevelRow = 2;

  const headerRow = 1;
  let r = writeTableHeader(ws, headerRow, ["No.", "Date", "Description", "Amount"], 4);
  const first = r;

  for (const m of groupBy(lines, (l) => l.main)) {
    // Main category band
    ws.mergeCells(`A${r}:${col(N)}${r}`);
    const band = ws.getRow(r++);
    band.getCell(1).value = m.name.toUpperCase();
    band.height = 22;
    paint(band, N, {
      font: font({ bold: true, size: 11, color: { argb: NAVY } }),
      fill: solid(BAND),
      border: { top: navyThin },
    });
    band.getCell(1).alignment = { vertical: "middle", indent: 1 };
    const mainFrom = r;

    for (const c of groupBy(m.items, (l) => l.category)) {
      // Category heading
      ws.mergeCells(`A${r}:${col(N)}${r}`);
      const head = ws.getRow(r++);
      head.getCell(1).value = c.name;
      head.outlineLevel = 2;
      paint(head, N, {
        font: font({ bold: true, color: { argb: BLUE } }),
        fill: solid(BAND_SOFT),
        border: { bottom: rule },
      });
      head.getCell(1).alignment = { vertical: "middle", indent: 2 };

      const from = r;
      c.items.forEach((l, i) => {
        const row = ws.getRow(r++);
        row.values = [l.ref, toExcelDate(l.date), l.description, l.amount];
        row.outlineLevel = 2;
        paint(row, N, {
          font: font(),
          border: { bottom: rule },
          ...(i % 2 === 1 ? { fill: solid(ZEBRA) } : {}),
        });
        row.getCell(1).numFmt = REF;
        row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(1).font = font({ color: { argb: MUTED } });
        row.getCell(2).numFmt = DATE;
        row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
        row.getCell(3).alignment = { vertical: "middle", wrapText: true };
        row.getCell(4).numFmt = CURRENCY;
      });

      // Category subtotal
      ws.mergeCells(`A${r}:C${r}`);
      const sub = ws.getRow(r);
      sub.getCell(1).value = `Subtotal ${c.name}  (${c.count} ${c.count === 1 ? "item" : "items"})`;
      sub.getCell(4).value = f(`SUBTOTAL(9,D${from}:D${r - 1})`, c.amount);
      sub.getCell(4).numFmt = CURRENCY;
      sub.outlineLevel = 1;
      paint(sub, N, { font: font({ bold: true }), border: { top: navyThin, bottom: rule } });
      sub.getCell(1).font = font({ italic: true, color: { argb: MUTED } });
      alignRight(sub.getCell(1));
      r++;
    }

    // Main category total — SUBTOTAL skips the nested subtotals, so no double counting
    ws.mergeCells(`A${r}:C${r}`);
    const tot = ws.getRow(r);
    tot.getCell(1).value = `Total ${m.name}`;
    tot.getCell(4).value = f(`SUBTOTAL(9,D${mainFrom}:D${r - 1})`, m.amount);
    tot.getCell(4).numFmt = CURRENCY;
    tot.height = 20;
    paint(tot, N, {
      font: font({ bold: true, color: { argb: NAVY } }),
      fill: solid(BAND),
      border: { top: navyThin, bottom: navyThin },
    });
    alignRight(tot.getCell(1));
    r += 2; // blank spacer row between main categories
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  ws.mergeCells(`A${r}:C${r}`);
  const grand = ws.getRow(r);
  grand.getCell(1).value =
    `GRAND TOTAL  (${lines.length} ${lines.length === 1 ? "transaction" : "transactions"})`;
  grand.getCell(4).value = f(`SUBTOTAL(9,D${first}:D${r - 1})`, total);
  grand.getCell(4).numFmt = CURRENCY;
  grand.height = 24;
  paint(grand, N, {
    font: font({ bold: true, size: 11, color: { argb: WHITE } }),
    fill: solid(NAVY),
    border: { bottom: navyDouble },
  });
  alignRight(grand.getCell(1));

  ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
}

/* ── Sheet 3: Transactions ─────────────────────────────────────────────── */

function addTransactionsSheet(wb: ExcelJS.Workbook, lines: Line[]) {
  // No. | Date | Main category | Category | Description | Amount
  const N = 6;
  const ws = newSheet(wb, "Transactions", [8, 14, 20, 22, 46, 16]);
  ws.pageSetup.orientation = "landscape";

  const headerRow = 1;
  const first = writeTableHeader(
    ws,
    headerRow,
    ["No.", "Date", "Main category", "Category", "Description", "Amount"],
    6,
  );

  lines.forEach((l, i) => {
    const row = ws.getRow(first + i);
    row.values = [l.ref, toExcelDate(l.date), l.main, l.category, l.description, l.amount];
    paint(row, N, {
      font: font(),
      border: { bottom: rule },
      ...(i % 2 === 1 ? { fill: solid(ZEBRA) } : {}),
    });
    row.getCell(1).numFmt = REF;
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(1).font = font({ color: { argb: MUTED } });
    row.getCell(2).numFmt = DATE;
    row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
    row.getCell(5).alignment = { vertical: "middle", wrapText: true };
    row.getCell(6).numFmt = CURRENCY;
  });
  const last = first + lines.length - 1;
  const total = lines.reduce((s, l) => s + l.amount, 0);

  // SUBTOTAL(9) ignores rows hidden by the filter, so the total matches what's shown
  ws.mergeCells(`A${last + 1}:E${last + 1}`);
  const t = ws.getRow(last + 1);
  t.getCell(1).value = "Total";
  t.getCell(6).value = f(`SUBTOTAL(9,F${first}:F${last})`, total);
  t.getCell(6).numFmt = CURRENCY;
  styleTotalRow(t, N);
  alignRight(t.getCell(1));

  ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: last, column: N } };
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
}

/** Expenses in categories flagged "exclude from export" (personal stuff) never reach the workbook. */
export function exportableExpenses(expenses: ExpenseWithCategory[]) {
  return expenses.filter((e) => !e.category?.exclude_from_export);
}

/* ── Entry point ───────────────────────────────────────────────────────── */

export function buildWorkbook(expenses: ExpenseWithCategory[], opts: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "dzz-expenses";
  wb.title = `Expense report — ${opts.periodLabel}`;
  wb.subject = "Expense report";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const lines = toLines(exportableExpenses(expenses));
  addSummarySheet(wb, lines);
  addDetailSheet(wb, lines);
  addTransactionsSheet(wb, lines);
  return wb;
}

export async function exportExpensesToExcel(expenses: ExpenseWithCategory[], opts: ExportOptions) {
  const wb = buildWorkbook(expenses, opts);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Expense_Report_${opts.fileLabel}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
