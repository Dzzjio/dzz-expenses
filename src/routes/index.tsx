import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
import { exportExpensesToExcel } from "@/lib/export-excel";

import { supabase } from "@/integrations/supabase/client";
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

function fileLabel(preset: RangePreset, monthCursor: Date, yearCursor: number) {
  if (preset === "month")
    return `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
  if (preset === "year") return String(yearCursor);
  return todayISO();
}


function DashboardPage() {
  const qc = useQueryClient();

  const { data: mainCategories = [] } = useQuery({
    queryKey: ["main_categories"],
    queryFn: fetchMainCategories,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: fetchExpenses,
  });

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [mcOpen, setMcOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithCategory | null>(null);
  const [deleting, setDeleting] = useState<ExpenseWithCategory | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [mainFilter, setMainFilter] = useState<string>("all");
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
    if (rangePreset === "year")
      return { from: `${yearCursor}-01-01`, to: `${yearCursor}-12-31` };
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

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category_id !== categoryFilter) return false;
      if (mainFilter !== "all" && e.category?.main_category_id !== mainFilter) return false;
      if (e.expense_date < from || e.expense_date > to) return false;
      return true;
    });
  }, [expenses, categoryFilter, mainFilter, from, to]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
    const count = filtered.length;
    const avg = count > 0 ? total / count : 0;
    return { total, count, avg };
  }, [filtered]);

  const label = rangeLabel(rangePreset, from, to, monthCursor, yearCursor);

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

  function handleExport() {
    if (filtered.length === 0) {
      toast.error(`No expenses in ${label}`);
      return;
    }
    exportExpensesToExcel(filtered, fileLabel(rangePreset, monthCursor, yearCursor));
    toast.success("Export ready");
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Spend
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Personal expense tracker
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMcOpen(true)}>
              <Tag className="mr-1.5 h-4 w-4" /> Main category
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
              <Tag className="mr-1.5 h-4 w-4" /> Category
            </Button>
            <Button asChild variant="ghost" size="sm" title="Manage categories">
              <Link to="/manage-categories">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-4 w-4" /> Export
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
                    <Label className="text-xs">
                      {rangePreset === "month" ? "Month" : "Year"}
                    </Label>
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
                  <Select value={mainFilter} onValueChange={setMainFilter}>
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
          />
          <SummaryCard
            icon={<Receipt className="h-4 w-4" />}
            label="Expenses"
            value={String(stats.count)}
            hint={label}
          />
          <SummaryCard
            icon={<Wallet className="h-4 w-4" />}
            label="Average / expense"
            value={formatCurrency(stats.avg)}
            hint={label}
          />
        </section>

        {/* Charts */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By category · {label}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart expenses={filtered} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending over time · {label}</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingLineChart expenses={filtered} from={from} to={to} />
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
                          <p className="mt-1.5 truncate text-sm text-foreground">
                            {e.description}
                          </p>
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
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
