import ExcelJS from "exceljs";

import type { ExpenseWithCategory } from "@/lib/expenses";

/**
 * This file controls the DESIGN of the exported Excel workbook. It is laid out
 * like a formal expense report:
 *
 *   Sheet "Summary"              – report details, key figures, spending by main
 *                                  category → category, and by month (2+ months)
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
  /** Human label for the period, e.g. "September 2026". Goes in the title block. */
  periodLabel: string;
  /** Filename-safe label, e.g. "2026-09". */
  fileLabel: string;
  /** Active filters, shown in the title block so the reader knows what's included. */
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
const MONTH = "mmmm yyyy";

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

function longDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

function scopeText(opts: ExportOptions) {
  const bits: string[] = [];
  if (opts.filters?.mainCategory) bits.push(`Main category “${opts.filters.mainCategory}”`);
  if (opts.filters?.category) bits.push(`Category “${opts.filters.category}”`);
  return bits.length ? bits.join(", ") : "All categories";
}

/** Page header/footer codes treat "&" as a control character. */
function escapeHF(s: string) {
  return s.replace(/&/g, "&&");
}

function newSheet(wb: ExcelJS.Workbook, name: string, widths: number[], opts: ExportOptions) {
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
    headerFooter: {
      oddFooter: `&L&8Expense report · ${escapeHF(opts.periodLabel)}&R&8Page &P of &N`,
    },
  });
  ws.columns = widths.map((width) => ({ width }));
  return ws;
}

/**
 * Navy title band, period line and "prepared on / scope" line. Returns the next
 * free row number (after one blank spacer row).
 */
function writeTitleBlock(ws: ExcelJS.Worksheet, title: string, opts: ExportOptions, n: number) {
  const last = col(n);

  ws.mergeCells(`A1:${last}1`);
  const t = ws.getRow(1);
  t.height = 34;
  t.getCell(1).value = title.toUpperCase();
  paint(t, n, { font: font({ bold: true, size: 16, color: { argb: WHITE } }), fill: solid(NAVY) });
  t.getCell(1).alignment = { vertical: "middle", indent: 1 };

  ws.mergeCells(`A2:${last}2`);
  const p = ws.getRow(2);
  p.height = 22;
  p.getCell(1).value = `Reporting period: ${opts.periodLabel}`;
  paint(p, n, {
    font: font({ bold: true, size: 11, color: { argb: NAVY } }),
    fill: solid(BAND),
  });
  p.getCell(1).alignment = { vertical: "middle", indent: 1 };

  ws.mergeCells(`A3:${last}3`);
  const m = ws.getRow(3);
  m.getCell(1).value =
    `Scope: ${scopeText(opts)}   ·   Prepared on ${longDate(new Date())}   ·   Amounts in EUR`;
  m.getCell(1).font = font({ size: 9, italic: true, color: { argb: MUTED } });
  m.getCell(1).alignment = { vertical: "middle", indent: 1 };

  return 5;
}

/** Blue section heading with a navy underline across the table width. */
function writeSection(ws: ExcelJS.Worksheet, r: number, text: string, n: number) {
  const row = ws.getRow(r);
  row.height = 22;
  row.getCell(1).value = text;
  paint(row, n, {
    font: font({ bold: true, size: 12, color: { argb: BLUE } }),
    border: { bottom: navyMedium },
  });
  return r + 1;
}

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

function addSummarySheet(wb: ExcelJS.Workbook, lines: Line[], opts: ExportOptions) {
  // Name | Transactions | Amount | % of total | Average per transaction
  const N = 5;
  const ws = newSheet(wb, "Summary", [38, 14, 18, 12, 20], opts);
  let r = writeTitleBlock(ws, "Expense report", opts, N);

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const count = lines.length;
  const mains = groupBy(lines, (l) => l.main);
  const largest = lines.reduce((a, b) => (b.amount > a.amount ? b : a), lines[0]);

  /* Key figures — label spans A:B, value sits in the Amount column */
  r = writeSection(ws, r, "Key figures", N);
  const figures: [string, ExcelJS.CellValue, string][] = [
    ["Total expenditure", total, CURRENCY],
    ["Number of transactions", count, INTEGER],
    ["Average per transaction", count ? total / count : 0, CURRENCY],
    ["Largest single expense", largest?.amount ?? 0, CURRENCY],
    [
      "Transactions dated",
      count
        ? `${longDate(toExcelDate(lines[0].date))} – ${longDate(toExcelDate(lines[count - 1].date))}`
        : "—",
      "@",
    ],
  ];
  figures.forEach(([label, value, fmt], i) => {
    const row = ws.getRow(r);
    ws.mergeCells(`A${r}:B${r}`);
    ws.mergeCells(`C${r}:${col(N)}${r}`);
    row.getCell(1).value = label;
    row.getCell(3).value = value;
    row.getCell(3).numFmt = fmt;
    paint(row, N, { font: font(), border: { bottom: rule } });
    row.getCell(1).font = font({ color: { argb: MUTED } });
    row.getCell(3).font = font({
      bold: true,
      size: i === 0 ? 12 : 10,
      color: { argb: i === 0 ? NAVY : TEXT },
    });
    row.getCell(3).alignment = { vertical: "middle", horizontal: "left" };
    if (i === 0) row.height = 22;
    r++;
  });
  r++;

  /* Expenditure by category — main categories with their categories indented */
  r = writeSection(ws, r, "Expenditure by category", N);
  r = writeTableHeader(
    ws,
    r,
    ["Main category / Category", "Transactions", "Amount", "% of total", "Average per transaction"],
    2,
  );

  const firstBody = r;
  // Row count is known up front so shares can reference the total row
  const totalRow =
    firstBody + mains.reduce((s, m) => s + 1 + groupBy(m.items, (l) => l.category).length, 0);

  for (const m of mains) {
    const cats = groupBy(m.items, (l) => l.category);
    const mr = r++;
    const from = r;
    const to = r + cats.length - 1;

    const mRow = ws.getRow(mr);
    mRow.values = [
      m.name,
      f(`SUBTOTAL(9,B${from}:B${to})`, m.count),
      f(`SUBTOTAL(9,C${from}:C${to})`, m.amount),
      f(`IF($C$${totalRow}=0,0,C${mr}/$C$${totalRow})`, total ? m.amount / total : 0),
      f(`IF(B${mr}=0,0,C${mr}/B${mr})`, m.count ? m.amount / m.count : 0),
    ];
    paint(mRow, N, {
      font: font({ bold: true, color: { argb: NAVY } }),
      fill: solid(BAND),
      border: { top: navyThin, bottom: rule },
    });
    mRow.height = 20;

    for (const c of cats) {
      const cr = r++;
      const cRow = ws.getRow(cr);
      cRow.values = [
        c.name,
        c.count,
        c.amount,
        f(`IF($C$${totalRow}=0,0,C${cr}/$C$${totalRow})`, total ? c.amount / total : 0),
        f(`IF(B${cr}=0,0,C${cr}/B${cr})`, c.count ? c.amount / c.count : 0),
      ];
      paint(cRow, N, { font: font(), border: { bottom: rule } });
      cRow.getCell(1).alignment = { vertical: "middle", indent: 2 };
    }
    [mRow, ...Array.from({ length: cats.length }, (_, i) => ws.getRow(from + i))].forEach((row) => {
      row.getCell(2).numFmt = INTEGER;
      row.getCell(3).numFmt = CURRENCY;
      row.getCell(4).numFmt = PERCENT;
      row.getCell(5).numFmt = CURRENCY;
    });
  }

  const tRow = ws.getRow(totalRow);
  tRow.values = [
    "Total",
    f(`SUBTOTAL(9,B${firstBody}:B${totalRow - 1})`, count),
    f(`SUBTOTAL(9,C${firstBody}:C${totalRow - 1})`, total),
    f(`IF(C${totalRow}=0,0,1)`, total ? 1 : 0),
    f(`IF(B${totalRow}=0,0,C${totalRow}/B${totalRow})`, count ? total / count : 0),
  ];
  tRow.getCell(2).numFmt = INTEGER;
  tRow.getCell(3).numFmt = CURRENCY;
  tRow.getCell(4).numFmt = PERCENT;
  tRow.getCell(5).numFmt = CURRENCY;
  styleTotalRow(tRow, N);
  r = totalRow + 2;

  /* Expenditure by month — only when the report spans 2+ months */
  const months = groupBy(lines, (l) => l.date.slice(0, 7)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (months.length >= 2) {
    r = writeSection(ws, r, "Expenditure by month", N);
    r = writeTableHeader(
      ws,
      r,
      ["Month", "Transactions", "Amount", "% of total", "Average per transaction"],
      2,
    );
    const first = r;
    const mTotal = first + months.length;
    months.forEach((mo, i) => {
      const row = ws.getRow(r);
      row.values = [
        toExcelDate(`${mo.name}-01`),
        mo.count,
        mo.amount,
        f(`IF($C$${mTotal}=0,0,C${r}/$C$${mTotal})`, total ? mo.amount / total : 0),
        f(`IF(B${r}=0,0,C${r}/B${r})`, mo.count ? mo.amount / mo.count : 0),
      ];
      row.getCell(1).numFmt = MONTH;
      row.getCell(1).alignment = { horizontal: "left" };
      row.getCell(2).numFmt = INTEGER;
      row.getCell(3).numFmt = CURRENCY;
      row.getCell(4).numFmt = PERCENT;
      row.getCell(5).numFmt = CURRENCY;
      paint(row, N, {
        font: font(),
        border: { bottom: rule },
        ...(i % 2 === 1 ? { fill: solid(ZEBRA) } : {}),
      });
      r++;
    });
    const mt = ws.getRow(mTotal);
    mt.values = [
      "Total",
      f(`SUM(B${first}:B${mTotal - 1})`, count),
      f(`SUM(C${first}:C${mTotal - 1})`, total),
      f(`IF(C${mTotal}=0,0,1)`, total ? 1 : 0),
      f(`IF(B${mTotal}=0,0,C${mTotal}/B${mTotal})`, count ? total / count : 0),
    ];
    mt.getCell(2).numFmt = INTEGER;
    mt.getCell(3).numFmt = CURRENCY;
    mt.getCell(4).numFmt = PERCENT;
    mt.getCell(5).numFmt = CURRENCY;
    styleTotalRow(mt, N);
    r = mTotal + 2;
  }

  /* Notes */
  r = writeSection(ws, r, "Notes", N);
  const notes = [
    "1.  All amounts are stated in euro (EUR) and cover every transaction within the scope shown above.",
    "2.  “Detail by category” lists each transaction under its category with subtotals; use the outline buttons on the left to collapse it.",
    "3.  “Transactions” lists all entries in date order. Its total follows any filter applied to the table.",
    "4.  Reference numbers (No.) identify the same transaction on every sheet.",
  ];
  for (const text of notes) {
    ws.mergeCells(`A${r}:${col(N)}${r}`);
    const row = ws.getRow(r);
    row.getCell(1).value = text;
    row.getCell(1).font = font({ size: 9, color: { argb: MUTED } });
    row.getCell(1).alignment = { vertical: "top", wrapText: true };
    row.height = 26;
    r++;
  }

  ws.views = [{ showGridLines: false }];
}

/* ── Sheet 2: Detail by category ───────────────────────────────────────── */

function addDetailSheet(wb: ExcelJS.Workbook, lines: Line[], opts: ExportOptions) {
  // No. | Date | Description | Amount
  const N = 4;
  const ws = newSheet(wb, "Detail by category", [8, 14, 62, 18], opts);
  ws.properties.outlineProperties = { summaryBelow: true, summaryRight: false };
  ws.properties.outlineLevelRow = 2;

  const headerRow = writeTitleBlock(ws, "Expense detail by category", opts, N);
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

function addTransactionsSheet(wb: ExcelJS.Workbook, lines: Line[], opts: ExportOptions) {
  // No. | Date | Main category | Category | Description | Amount
  const N = 6;
  const ws = newSheet(wb, "Transactions", [8, 14, 20, 22, 46, 16], opts);
  ws.pageSetup.orientation = "landscape";

  const headerRow = writeTitleBlock(ws, "Transaction ledger", opts, N);
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

/* ── Entry point ───────────────────────────────────────────────────────── */

export function buildWorkbook(expenses: ExpenseWithCategory[], opts: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "dzz-expenses";
  wb.title = `Expense report — ${opts.periodLabel}`;
  wb.subject = "Expense report";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const lines = toLines(expenses);
  addSummarySheet(wb, lines, opts);
  addDetailSheet(wb, lines, opts);
  addTransactionsSheet(wb, lines, opts);
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
