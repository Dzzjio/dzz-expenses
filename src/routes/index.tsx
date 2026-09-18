import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Plus,
  Download,
  Pencil,
  Trash2,
  Wallet,
  TrendingUp,
  Receipt,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCategories,
  fetchExpenses,
  fetchMainCategories,
  formatCurrency,
  type ExpenseWithCategory,
} from "@/lib/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryBadge } from "@/components/expense/CategoryBadge";
import { CategoryChart } from "@/components/expense/CategoryChart";
import { SpendingLineChart } from "@/components/expense/SpendingLineChart";
import { CategoryDialog } from "@/components/expense/CategoryDialog";
import { MainCategoryDialog } from "@/components/expense/MainCategoryDialog";
import { ExpenseDialog } from "@/components/expense/ExpenseDialog";
import { SettingsDialog } from "@/components/SettingsDialog";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Spend — personal expense tracker" },
      {
        name: "description",
        content: "A minimal expense tracker to log, categorize, and export your spending.",
      },
      { property: "og:title", content: "Spend — personal expense tracker" },
      {
        property: "og:description",
        content: "A minimal expense tracker to log, categorize, and export your spending.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type RangePreset = "month" | "year" | "all" | "custom";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function startOfMonthISO(d = new Date()) {
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonthISO(d = new Date()) {
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function todayISO() {
  return iso(new Date());
}

function formatDate(isoStr: string) {
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function rangeLabel(
  preset: RangePreset,
  from: string,
  to: string,
  monthCursor: Date,
  yearCursor: number,
) {
  if (preset === "month") return monthLabel(monthCursor);
  if (preset === "year") return String(yearCursor);
  if (preset === "all") return "All time";
  return `${formatDate(from)} – ${formatDate(to)}`;
}

type Period = { from: string; to: string; label: string; shortLabel: string };

/** The period immediately before the current one, same length. "All time" has none. */
function previousPeriod(
  preset: RangePreset,
  from: string,
  to: string,
  monthCursor: Date,
  yearCursor: number,
): Period | null {
  if (preset === "month") {
    const p = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    return {
      from: startOfMonthISO(p),
      to: endOfMonthISO(p),
      label: monthLabel(p),
      shortLabel: p.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    };
  }
  if (preset === "year") {
    const y = yearCursor - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), shortLabel: String(y) };
  }
  if (preset === "custom") {
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - (days - 1));
    return {
      from: iso(pStart),
      to: iso(pEnd),
      label: `${formatDate(iso(pStart))} – ${formatDate(iso(pEnd))}`,
      shortLabel: "previous period",
    };
  }
  return null;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function fileLabel(preset: RangePreset, monthCursor: Date, yearCursor: number) {
  if (preset === "month")
    return `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
  if (preset === "year") return String(yearCursor);
  return todayISO();
}

function DashboardPage() {
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", replace: true });
  }, [authLoading, user, navigate]);

  const { data: mainCategories = [] } = useQuery({
    queryKey: ["main_categories", user?.id],
    queryFn: fetchMainCategories,
    enabled: !!user,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: fetchCategories,
    enabled: !!user,
  });
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: fetchExpenses,
    enabled: !!user,
  });
  const isLoading = authLoading || expensesLoading;

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [mcOpen, setMcOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithCategory | null>(null);
  const [deleting, setDeleting] = useState<ExpenseWithCategory | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [mainFilter, setMainFilter] = useState<string>("all");

  // Changing the main category drops a sub-category pick that no longer belongs to it,
  // otherwise the Category select shows a stale value and every row gets filtered out.
  function handleMainFilterChange(next: string) {
    setMainFilter(next);
    if (categoryFilter === "all" || next === "all") return;
    const selected = categories.find((c) => c.id === categoryFilter);
    if (selected && selected.main_category_id !== next) setCategoryFilter("all");
  }
  const [rangePreset, setRangePreset] = useState<RangePreset>("month");
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [yearCursor, setYearCursor] = useState(() => new Date().getFullYear());
  const [customFrom, setCustomFrom] = useState(startOfMonthISO());
  const [customTo, setCustomTo] = useState(todayISO());

  const { from, to } = useMemo(() => {
    if (rangePreset === "month")
      return { from: startOfMonthISO(monthCursor), to: endOfMonthISO(monthCursor) };
    if (rangePreset === "year") return { from: `${yearCursor}-01-01`, to: `${yearCursor}-12-31` };
    if (rangePreset === "custom") return { from: customFrom, to: customTo };
    return { from: "0000-01-01", to: "9999-12-31" };
  }, [rangePreset, monthCursor, yearCursor, customFrom, customTo]);

  function shiftRange(dir: -1 | 1) {
    if (rangePreset === "month") {
      setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
    } else if (rangePreset === "year") {
      setYearCursor((y) => y + dir);
    }
  }

  const byCategory = useMemo(
    () =>
      expenses.filter((e) => {
        if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
        if (mainFilter !== "all" && e.category?.main_category_id !== mainFilter) return false;
        return true;
      }),
    [expenses, categoryFilter, mainFilter],
  );

  const filtered = useMemo(
    () => byCategory.filter((e) => e.expense_date >= from && e.expense_date <= to),
    [byCategory, from, to],
  );

  const previous = useMemo(
    () => previousPeriod(rangePreset, from, to, monthCursor, yearCursor),
    [rangePreset, from, to, monthCursor, yearCursor],
  );

  // Same category filters, previous period — what the deltas and the dashed line compare against.
  const prevFiltered = useMemo(
    () =>
      previous
        ? byCategory.filter((e) => e.expense_date >= previous.from && e.expense_date <= previous.to)
        : [],
    [byCategory, previous],
  );

  const stats = useMemo(() => summarize(filtered), [filtered]);
  const prevStats = useMemo(() => summarize(prevFiltered), [prevFiltered]);

  const label = rangeLabel(rangePreset, from, to, monthCursor, yearCursor);

  // Clicking a slice or legend row drives the same filters as the selects (click again to clear).
  function selectMain(id: string) {
    if (mainFilter === id) {
      setMainFilter("all");
    } else {
      setMainFilter(id);
    }
    setCategoryFilter("all");
  }
  function selectCategory(id: string, mainId: string) {
    if (categoryFilter === id) {
      setCategoryFilter("all");
    } else {
      setMainFilter(mainId);
      setCategoryFilter(id);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (filtered.length === 0) {
      toast.error(`No expenses in ${label}`);
      return;
    }
    setExporting(true);
    try {
      // Loaded on demand: the spreadsheet library is big and most sessions never export
      const { exportExpensesToExcel } = await import("@/lib/export-excel");
      await exportExpensesToExcel(filtered, {
        periodLabel: label,
        fileLabel: fileLabel(rangePreset, monthCursor, yearCursor),
        filters: {
          mainCategory: mainCategories.find((m) => m.id === mainFilter)?.name,
          category: categories.find((c) => c.id === categoryFilter)?.name,
        },
      });
      toast.success("Export ready");
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/coin.png" alt="Logo" className="h-24 w-24 coin-spin" />

            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                dzz-expenses
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">Personal expense tracker</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMcOpen(true)}>
              <Tag className="mr-1.5 h-4 w-4" /> Main category
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
              <Tag className="mr-1.5 h-4 w-4" /> Category
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="mr-1.5 h-4 w-4" /> {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add expense
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="Settings"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Global timeline filter */}
        <section className="mt-6">
          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date range</Label>
                  <Select
                    value={rangePreset}
                    onValueChange={(v) => setRangePreset(v as RangePreset)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(rangePreset === "month" || rangePreset === "year") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{rangePreset === "month" ? "Month" : "Year"}</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        aria-label="Previous period"
                        onClick={() => shiftRange(-1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex h-9 flex-1 items-center justify-center rounded-md border px-2 text-sm font-medium tabular-nums">
                        {label}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        aria-label="Next period"
                        onClick={() => shiftRange(1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {rangePreset === "custom" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">From</Label>
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To</Label>
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Main category</Label>
                  <Select value={mainFilter} onValueChange={handleMainFilterChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All main</SelectItem>
                      {mainCategories.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: m.color }}
                            />
                            {m.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories
                        .filter((c) => mainFilter === "all" || c.main_category_id === mainFilter)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Summary cards (reflect current filter) */}
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total spent"
            value={formatCurrency(stats.total)}
            hint={label}
            delta={
              previous && {
                pct: pctChange(stats.total, prevStats.total),
                text: formatCurrency(Math.abs(stats.total - prevStats.total)),
                vs: previous.shortLabel,
              }
            }
          />
          <SummaryCard
            icon={<Receipt className="h-4 w-4" />}
            label="Expenses"
            value={String(stats.count)}
            hint={label}
            delta={
              previous && {
                pct: pctChange(stats.count, prevStats.count),
                text: String(Math.abs(stats.count - prevStats.count)),
                vs: previous.shortLabel,
                absolute: true,
              }
            }
          />
          <SummaryCard
            icon={<Wallet className="h-4 w-4" />}
            label="Average / expense"
            value={formatCurrency(stats.avg)}
            hint={label}
            delta={
              previous && {
                pct: pctChange(stats.avg, prevStats.avg),
                text: formatCurrency(Math.abs(stats.avg - prevStats.avg)),
                vs: previous.shortLabel,
              }
            }
          />
        </section>

        {/* Charts */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By category · {label}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart
                expenses={filtered}
                activeMain={mainFilter}
                activeCategory={categoryFilter}
                onSelectMain={selectMain}
                onSelectCategory={selectCategory}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending over time · {label}</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingLineChart
                expenses={filtered}
                from={from}
                to={to}
                label={label}
                compare={previous && { ...previous, expenses: prevFiltered }}
              />
            </CardContent>
          </Card>
        </section>

        {/* Table */}
        <section className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Expenses · {label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "expense" : "expenses"}
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(stats.total)}
                </span>
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                          No expenses match your filters.
                        </td>
                      </tr>
                    )}
                    {filtered.map((e) => (
                      <tr key={e.id} className="border-t hover:bg-muted/30">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {formatDate(e.expense_date)}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {e.description || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {e.category && <CategoryBadge category={e.category} />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                          {formatCurrency(Number(e.amount))}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditing(e);
                                setExpenseOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleting(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="space-y-2 sm:hidden">
                {isLoading && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                )}
                {!isLoading && filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No expenses match your filters.
                  </p>
                )}
                {filtered.map((e) => (
                  <div key={e.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {e.category && <CategoryBadge category={e.category} />}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(e.expense_date)}
                          </span>
                        </div>
                        {e.description && (
                          <p className="mt-1.5 truncate text-sm text-foreground">{e.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">
                          {formatCurrency(Number(e.amount))}
                        </div>
                        <div className="mt-1 flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditing(e);
                              setExpenseOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleting(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        categories={categories}
        expense={editing}
      />
      <CategoryDialog open={catOpen} onOpenChange={setCatOpen} />
      <MainCategoryDialog open={mcOpen} onOpenChange={setMcOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The expense will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function summarize(list: ExpenseWithCategory[]) {
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const count = list.length;
  const avg = count > 0 ? total / count : 0;
  return { total, count, avg };
}

type Delta = {
  /** Percent change, or null when the previous period had nothing to compare against. */
  pct: number | null;
  /** Absolute change, already formatted. */
  text: string;
  /** What we're comparing with, e.g. "Aug 2026". */
  vs: string;
  /** Show the absolute change instead of the percentage (used for counts). */
  absolute?: boolean;
};

/** Past this, "+6354%" says less than "+€3,177" does. */
const PCT_DISPLAY_LIMIT = 1000;

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.pct === null) {
    return <span className="text-muted-foreground/70">no data for {delta.vs}</span>;
  }
  const flat = Math.abs(delta.pct) < 0.5;
  const up = delta.pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const showAbsolute = delta.absolute || Math.abs(delta.pct) >= PCT_DISPLAY_LIMIT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        // Spending more than before reads as a warning; less as a win.
        flat ? "text-muted-foreground" : up ? "text-destructive" : "text-primary",
      )}
      title={`${up ? "+" : "−"}${delta.text} vs ${delta.vs}`}
    >
      <Icon className="h-3 w-3" />
      {flat ? "same" : showAbsolute ? delta.text : `${Math.abs(delta.pct).toFixed(0)}%`}
      <span className="ml-1 font-normal text-muted-foreground">vs {delta.vs}</span>
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  delta?: Delta | null;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{hint}</span>
          {delta && <DeltaBadge delta={delta} />}
        </div>
      </CardContent>
    </Card>
  );
}
