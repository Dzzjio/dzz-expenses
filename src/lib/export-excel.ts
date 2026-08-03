import * as XLSX from "xlsx";

import type { ExpenseWithCategory } from "@/lib/expenses";

/**
 * This file controls the DESIGN of the exported Excel file:
 * column order, column widths, the sheet name, the total row and the filename.
 * Edit freely — nothing else in the app depends on the layout below.
 */

export type ExportRow = {
  Date: string;
  Description: string;
  "Main Category": string;
  Category: string;
  Amount: number;
};

export function buildExportRows(expenses: ExpenseWithCategory[]): ExportRow[] {
  const rows: ExportRow[] = expenses.map((e) => ({
    Date: e.expense_date,
    Description: e.description ?? "",
    "Main Category": e.category?.main_category?.name ?? "",
    Category: e.category?.name ?? "",
    Amount: Number(e.amount),
  }));

  rows.push({
    Date: "",
    Description: "",
    "Main Category": "",
    Category: "Total",
    Amount: rows.reduce((s, r) => s + r.Amount, 0),
  });

  return rows;
}

export function exportExpensesToExcel(
  expenses: ExpenseWithCategory[],
  fileLabel: string,
) {
  const rows = buildExportRows(expenses);

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths (in characters): Date, Description, Main Category, Category, Amount
  ws["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];

  // Number format for the Amount column (E), skipping the header row
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let r = 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, `expenses_export_${fileLabel}.xlsx`);
}
