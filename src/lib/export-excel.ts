import ExcelJS from "exceljs";

import type { ExpenseWithCategory } from "@/lib/expenses";

/**
 * This file controls the DESIGN of the exported Excel workbook.
 *
 *   Sheet "Expenses"     – title block, one row per expense, live SUM/COUNT/AVERAGE
 *   Sheet "By category"  – main category subtotals with their categories underneath
 *   Sheet "By month"     – monthly totals (only when the export spans 2+ months)
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

const INK = "FF1F2937"; // header fill, title text
const INK_SOFT = "FF6B7280"; // secondary text
const RULE = "FFD1D5DB"; // cell borders
const ZEBRA = "FFF9FAFB"; // alternate row fill
const TOTAL_FILL = "FFF3F4F6";
const WHITE = "FFFFFFFF";

const CURRENCY = '#,##0.00 "€"';
const PERCENT = "0.0%";
const DATE = "dd mmm yyyy";
const MONTH = "mmmm yyyy";

const FONT = "Calibri";

const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: RULE } };
const cellBorder: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** "YYYY-MM-DD" → Date at UTC midnight, so Excel shows exactly that day in any timezone. */
function toExcelDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: FONT, bold: true, color: { argb: WHITE }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", horizontal: cell.alignment?.horizontal ?? "left" };
    cell.border = cellBorder;
  });
}

function styleBodyRow(row: ExcelJS.Row, index: number) {
  // No explicit height: Excel then auto-fits rows with wrapped descriptions
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: FONT, size: 11 };
    cell.border = cellBorder;
    cell.alignment = { vertical: "middle", ...cell.alignment };
    if (index % 2 === 1) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
  });
}

function styleTotalRow(row: ExcelJS.Row) {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: FONT, bold: true, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    cell.border = {
      ...cellBorder,
      top: { style: "medium", color: { argb: INK } },
      bottom: { style: "double", color: { argb: INK } },
    };
    cell.alignment = { vertical: "middle", ...cell.alignment };
  });
}

/** Title + subtitle + filter lines at the top of a sheet. Returns the next free row number. */
function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  opts: ExportOptions,
  columns: number,
) {
  const lastCol = String.fromCharCode(64 + columns);

  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: FONT, bold: true, size: 16, color: { argb: INK } };
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(`A2:${lastCol}2`);
  const generated = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const s = ws.getCell("A2");
  s.value = `${opts.periodLabel}  ·  generated ${generated}`;
  s.font = { name: FONT, size: 11, color: { argb: INK_SOFT } };

  let row = 3;
  const filterBits: string[] = [];
  if (opts.filters?.mainCategory) filterBits.push(`Main category: ${opts.filters.mainCategory}`);
  if (opts.filters?.category) filterBits.push(`Category: ${opts.filters.category}`);
  if (filterBits.length > 0) {
    ws.mergeCells(`A3:${lastCol}3`);
    const f = ws.getCell("A3");
    f.value = `Filtered — ${filterBits.join("  ·  ")}`;
    f.font = { name: FONT, size: 10, italic: true, color: { argb: INK_SOFT } };
    row = 4;
  }
  return row + 1; // one blank spacer row
}

/* ── Sheet 1: Expenses ─────────────────────────────────────────────────── */

function addExpensesSheet(
  wb: ExcelJS.Workbook,
  expenses: ExpenseWithCategory[],
  opts: ExportOptions,
) {
  const ws = wb.addWorksheet("Expenses", {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { key: "date", width: 14 },
    { key: "description", width: 44 },
    { key: "main", width: 20 },
    { key: "category", width: 22 },
    { key: "amount", width: 16 },
  ];

  const headerRow = writeTitleBlock(ws, "Expense report", opts, 5);

  const header = ws.getRow(headerRow);
  header.values = ["Date", "Description", "Main category", "Category", "Amount"];
  header.getCell(5).alignment = { horizontal: "right" };
  styleHeaderRow(header);

  // Oldest first reads naturally in a report
  const sorted = [...expenses].sort((a, b) =>
    a.expense_date === b.expense_date
      ? a.created_at.localeCompare(b.created_at)
      : a.expense_date.localeCompare(b.expense_date),
  );

  const firstData = headerRow + 1;
  sorted.forEach((e, i) => {
    const row = ws.getRow(firstData + i);
    row.values = [
      toExcelDate(e.expense_date),
      e.description ?? "",
      e.category?.main_category?.name ?? "",
      e.category?.name ?? "",
      Number(e.amount),
    ];
    row.getCell(1).numFmt = DATE;
    row.getCell(5).numFmt = CURRENCY;
    row.getCell(2).alignment = { wrapText: true };
    styleBodyRow(row, i);
  });
  const lastData = firstData + sorted.length - 1;
  const amountRange = `E${firstData}:E${lastData}`;

  // Total — a live formula, so the sheet stays correct if rows are edited
  const total = ws.getRow(lastData + 1);
  total.values = ["", "", "", "Total", { formula: `SUM(${amountRange})` }];
  total.getCell(5).numFmt = CURRENCY;
  styleTotalRow(total);

  // Small summary block under the table
  const summary: [string, ExcelJS.CellValue, string?][] = [
    ["Number of expenses", { formula: `COUNT(${amountRange})` }],
    ["Average per expense", { formula: `AVERAGE(${amountRange})` }, CURRENCY],
    ["Largest expense", { formula: `MAX(${amountRange})` }, CURRENCY],
  ];
  summary.forEach(([label, value, fmt], i) => {
    const row = ws.getRow(lastData + 3 + i);
    row.getCell(4).value = label;
    row.getCell(4).font = { name: FONT, size: 11, color: { argb: INK_SOFT } };
    row.getCell(5).value = value;
    row.getCell(5).font = { name: FONT, size: 11, bold: true };
    if (fmt) row.getCell(5).numFmt = fmt;
  });

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastData, column: 5 } };
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
}

/* ── Sheet 2: By category ──────────────────────────────────────────────── */

type Bucket = { name: string; amount: number; count: number };

function addCategorySheet(
  wb: ExcelJS.Workbook,
  expenses: ExpenseWithCategory[],
  opts: ExportOptions,
) {
  const ws = wb.addWorksheet("By category");
  ws.columns = [
    { key: "main", width: 26 },
    { key: "category", width: 26 },
    { key: "amount", width: 16 },
    { key: "share", width: 12 },
    { key: "count", width: 10 },
  ];

  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // main → { bucket, categories: Map<catName, bucket> }
  const mains = new Map<string, Bucket & { categories: Map<string, Bucket> }>();
  for (const e of expenses) {
    const mName = e.category?.main_category?.name ?? "Ungrouped";
    const cName = e.category?.name ?? "Uncategorized";
    const amt = Number(e.amount);
    const m = mains.get(mName) ?? { name: mName, amount: 0, count: 0, categories: new Map() };
    m.amount += amt;
    m.count += 1;
    const c = m.categories.get(cName) ?? { name: cName, amount: 0, count: 0 };
    c.amount += amt;
    c.count += 1;
    m.categories.set(cName, c);
    mains.set(mName, m);
  }
  const byAmount = (a: Bucket, b: Bucket) => b.amount - a.amount;

  const headerRow = writeTitleBlock(ws, "Spending by category", opts, 5);
  const header = ws.getRow(headerRow);
  header.values = ["Main category", "Category", "Amount", "Share", "Count"];
  [3, 4, 5].forEach((c) => (header.getCell(c).alignment = { horizontal: "right" }));
  styleHeaderRow(header);

  let r = headerRow + 1;
  let zebra = 0;
  for (const m of [...mains.values()].sort(byAmount)) {
    // Main category subtotal line
    const mRow = ws.getRow(r++);
    mRow.values = [m.name, "", m.amount, grandTotal ? m.amount / grandTotal : 0, m.count];
    mRow.getCell(3).numFmt = CURRENCY;
    mRow.getCell(4).numFmt = PERCENT;
    styleBodyRow(mRow, 0);
    mRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 11, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    });

    for (const c of [...m.categories.values()].sort(byAmount)) {
      const cRow = ws.getRow(r++);
      cRow.values = ["", c.name, c.amount, grandTotal ? c.amount / grandTotal : 0, c.count];
      cRow.getCell(3).numFmt = CURRENCY;
      cRow.getCell(4).numFmt = PERCENT;
      cRow.getCell(2).alignment = { indent: 1 };
      styleBodyRow(cRow, zebra++);
    }
  }

  const total = ws.getRow(r);
  total.values = ["Total", "", grandTotal, 1, expenses.length];
  total.getCell(3).numFmt = CURRENCY;
  total.getCell(4).numFmt = PERCENT;
  styleTotalRow(total);

  ws.views = [{ state: "frozen", ySplit: headerRow }];
}

/* ── Sheet 3: By month ─────────────────────────────────────────────────── */

function addMonthSheet(wb: ExcelJS.Workbook, expenses: ExpenseWithCategory[], opts: ExportOptions) {
  const months = new Map<string, Bucket>();
  for (const e of expenses) {
    const key = e.expense_date.slice(0, 7);
    const b = months.get(key) ?? { name: key, amount: 0, count: 0 };
    b.amount += Number(e.amount);
    b.count += 1;
    months.set(key, b);
  }
  if (months.size < 2) return; // a single month adds nothing the first sheet doesn't say

  const ws = wb.addWorksheet("By month");
  ws.columns = [
    { key: "month", width: 20 },
    { key: "amount", width: 16 },
    { key: "count", width: 10 },
    { key: "avg", width: 18 },
  ];

  const headerRow = writeTitleBlock(ws, "Spending by month", opts, 4);
  const header = ws.getRow(headerRow);
  header.values = ["Month", "Amount", "Count", "Average / expense"];
  [2, 3, 4].forEach((c) => (header.getCell(c).alignment = { horizontal: "right" }));
  styleHeaderRow(header);

  const keys = [...months.keys()].sort();
  const firstData = headerRow + 1;
  keys.forEach((k, i) => {
    const b = months.get(k)!;
    const row = ws.getRow(firstData + i);
    const rowNo = firstData + i;
    row.values = [toExcelDate(`${k}-01`), b.amount, b.count, { formula: `B${rowNo}/C${rowNo}` }];
    row.getCell(1).numFmt = MONTH;
    row.getCell(2).numFmt = CURRENCY;
    row.getCell(4).numFmt = CURRENCY;
    styleBodyRow(row, i);
  });
  const lastData = firstData + keys.length - 1;

  const total = ws.getRow(lastData + 1);
  total.values = [
    "Total",
    { formula: `SUM(B${firstData}:B${lastData})` },
    { formula: `SUM(C${firstData}:C${lastData})` },
    { formula: `B${lastData + 1}/C${lastData + 1}` },
  ];
  total.getCell(2).numFmt = CURRENCY;
  total.getCell(4).numFmt = CURRENCY;
  styleTotalRow(total);

  ws.views = [{ state: "frozen", ySplit: headerRow }];
}

/* ── Entry point ───────────────────────────────────────────────────────── */

export function buildWorkbook(expenses: ExpenseWithCategory[], opts: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "dzz-expenses";
  wb.created = new Date();

  addExpensesSheet(wb, expenses, opts);
  addCategorySheet(wb, expenses, opts);
  addMonthSheet(wb, expenses, opts);
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
  a.download = `Expenses_${opts.fileLabel}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
