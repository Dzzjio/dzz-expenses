import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarRange,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { fetchExpenses, formatCurrency } from "@/lib/expenses";
import {
  alignBreakdowns,
  monthKeyOf,
  monthLabel,
  monthRange,
  pctChange,
  shiftMonth,
  summarizeMonths,
  type MonthKey,
  type MonthSummary,
} from "@/lib/summary";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartTooltipCard } from "@/components/expense/ChartTooltipCard";
import { DeltaBadge } from "@/components/expense/DeltaBadge";

export const Route = createFileRoute("/summary")({
  component: SummaryPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Monthly summary — Spend" },
      { name: "description", content: "Review and compare your spending month by month." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type RangeId = "last12" | "all" | `year:${number}`;
type Level = "main" | "category";

function SummaryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: fetchExpenses,
    enabled: !!user,
  });

  const thisMonth = monthKeyOf(new Date());

  // Everything rolled up once; range and comparison pick from it.
  const { all, byKey, years } = useMemo(() => {
    const keys = expenses.map((e) => e.expense_date.slice(0, 7));
    const earliest = keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : thisMonth;
    const latest = keys.length ? keys.reduce((a, b) => (a > b ? a : b)) : thisMonth;
    const end = latest > thisMonth ? latest : thisMonth;
    const all = summarizeMonths(expenses, monthRange(earliest, end));
    const byKey = new Map(all.map((m) => [m.key, m]));
    const years = [...new Set(all.map((m) => Number(m.key.slice(0, 4))))].sort((a, b) => b - a);
    return { all, byKey, years };
  }, [expenses, thisMonth]);

  const [range, setRange] = useState<RangeId>("last12");
  const months = useMemo(() => {
    if (range === "all") return all;
    if (range === "last12") {
      const from = shiftMonth(thisMonth, -11);
      return all.filter((m) => m.key >= from && m.key <= thisMonth);
    }
    const y = range.slice(5);
    return all.filter((m) => m.key.startsWith(y));
  }, [range, all, thisMonth]);

  // Compare A vs B — default to the latest month with data and the one before it.
  const [monthA, setMonthA] = useState<MonthKey | null>(null);
  const [monthB, setMonthB] = useState<MonthKey | null>(null);
  const [level, setLevel] = useState<Level>("main");
  const a = (monthA && byKey.get(monthA)) || latestWithData(months) || months.at(-1) || null;
  const b = (monthB && byKey.get(monthB)) || (a && byKey.get(shiftMonth(a.key, -1))) || null;

  // B is derived (one month before A) until the user pins it explicitly.
  function pickA(key: MonthKey) {
    setMonthA(key);
  }
  function swap() {
    if (!a || !b) return;
    setMonthA(b.key);
    setMonthB(a.key);
  }

  const stats = useMemo(() => {
    const active = months.filter((m) => m.count > 0);
    const total = months.reduce((s, m) => s + m.total, 0);
    const avg = active.length ? total / active.length : 0;
    const highest = active.reduce<MonthSummary | null>(
      (h, m) => (!h || m.total > h.total ? m : h),
      null,
    );
    const lowest = active.reduce<MonthSummary | null>(
      (l, m) => (!l || m.total < l.total ? m : l),
      null,
    );
    return { total, avg, highest, lowest, activeCount: active.length };
  }, [months]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const rangeLabel =
    range === "last12" ? "Last 12 months" : range === "all" ? "All time" : range.slice(5);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Monthly summary
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                How your months stack up against each other
              </p>
            </div>
          </div>
          <div className="w-44 space-y-1.5">
            <Label className="text-xs">Range</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last12">Last 12 months</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={`year:${y}`}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Range-level stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<CalendarRange className="h-4 w-4" />}
            label="Total"
            value={formatCurrency(stats.total)}
            hint={rangeLabel}
          />
          <Stat
            icon={<Receipt className="h-4 w-4" />}
            label="Monthly average"
            value={formatCurrency(stats.avg)}
            hint={`across ${stats.activeCount} ${stats.activeCount === 1 ? "month" : "months"} with spending`}
          />
          <Stat
            icon={<TrendingUp className="h-4 w-4" />}
            label="Highest month"
            value={stats.highest ? formatCurrency(stats.highest.total) : "—"}
            hint={stats.highest ? monthLabel(stats.highest.key) : "no data"}
            onClick={stats.highest ? () => pickA(stats.highest!.key) : undefined}
          />
          <Stat
            icon={<TrendingDown className="h-4 w-4" />}
            label="Lowest month"
            value={stats.lowest ? formatCurrency(stats.lowest.total) : "—"}
            hint={stats.lowest ? monthLabel(stats.lowest.key) : "no data"}
            onClick={stats.lowest ? () => pickA(stats.lowest!.key) : undefined}
          />
        </section>

        {/* Bar chart */}
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending by month · {rangeLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
              ) : months.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No expenses yet.</p>
              ) : (
                <MonthBars
                  months={months}
                  average={stats.avg}
                  a={a?.key ?? null}
                  b={b?.key ?? null}
                  onPick={pickA}
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Compare two months */}
        <section className="mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Compare months</CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <MonthPicker
                  label="Month A"
                  value={a?.key ?? ""}
                  options={all}
                  onChange={(k) => setMonthA(k)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Swap months"
                  title="Swap"
                  onClick={swap}
                  disabled={!a || !b}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                <MonthPicker
                  label="Month B"
                  value={b?.key ?? ""}
                  options={all}
                  onChange={(k) => setMonthB(k)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {a && b ? (
                <Comparison a={a} b={b} level={level} onLevelChange={setLevel} />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Pick two months to compare.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Month table */}
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All months · {rangeLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              <MonthTable
                months={months}
                byKey={byKey}
                a={a?.key ?? null}
                b={b?.key ?? null}
                onPick={pickA}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function latestWithData(months: MonthSummary[]) {
  for (let i = months.length - 1; i >= 0; i--) if (months[i].count > 0) return months[i];
  return null;
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Stat({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
}) {
  const inner = (
    <CardContent className="pt-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </CardContent>
  );
  return (
    <Card
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-muted/30")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={onClick ? "Select this month" : undefined}
    >
      {inner}
    </Card>
  );
}

function MonthPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: MonthKey | "";
  options: MonthSummary[];
  onChange: (k: MonthKey) => void;
}) {
  return (
    <div className="w-40 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a month" />
        </SelectTrigger>
        <SelectContent>
          {[...options].reverse().map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {monthLabel(m.key)}
              {m.count === 0 && <span className="ml-1 text-muted-foreground">· empty</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MonthBars({
  months,
  average,
  a,
  b,
  onPick,
}: {
  months: MonthSummary[];
  average: number;
  a: MonthKey | null;
  b: MonthKey | null;
  onPick: (k: MonthKey) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 bg-(--chart-1)" /> Month A
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 bg-(--chart-2)" /> Month B
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="4" aria-hidden>
            <line
              x1="0"
              y1="2"
              x2="20"
              y2="2"
              stroke="var(--muted-foreground)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Monthly average
        </span>
        <span className="ml-auto">Click a bar to select Month A</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="key"
              tickFormatter={(k: string) => monthLabel(k, "short")}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v) => `€${v}`}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={64}
            />
            <Tooltip
              wrapperStyle={{ zIndex: 20 }}
              cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as MonthSummary;
                return (
                  <ChartTooltipCard>
                    <div className="text-muted-foreground">{monthLabel(m.key)}</div>
                    <div className="mt-1 font-medium tabular-nums text-popover-foreground">
                      {formatCurrency(m.total)}
                    </div>
                    <div className="mt-0.5 tabular-nums text-muted-foreground">
                      {m.count} {m.count === 1 ? "expense" : "expenses"}
                      {m.count > 0 && ` · avg ${formatCurrency(m.avg)}`}
                    </div>
                  </ChartTooltipCard>
                );
              }}
            />
            {average > 0 && (
              <ReferenceLine
                y={average}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 3"
                strokeOpacity={0.8}
              />
            )}
            <Bar
              dataKey="total"
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
              onClick={(d: MonthSummary) => onPick(d.key)}
              cursor="pointer"
            >
              {months.map((m) => (
                <Cell
                  key={m.key}
                  fill={
                    m.key === a
                      ? "var(--chart-1)"
                      : m.key === b
                        ? "var(--chart-2)"
                        : "var(--chart-1)"
                  }
                  fillOpacity={m.key === a || m.key === b ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Comparison({
  a,
  b,
  level,
  onLevelChange,
}: {
  a: MonthSummary;
  b: MonthSummary;
  level: Level;
  onLevelChange: (l: Level) => void;
}) {
  const rows = alignBreakdowns(
    level === "main" ? a.byMain : a.byCategory,
    level === "main" ? b.byMain : b.byCategory,
  );
  const metrics: { label: string; a: number; b: number; money: boolean }[] = [
    { label: "Total spent", a: a.total, b: b.total, money: true },
    { label: "Expenses", a: a.count, b: b.count, money: false },
    { label: "Average / expense", a: a.avg, b: b.avg, money: true },
    { label: "Largest expense", a: a.max, b: b.max, money: true },
  ];
  const fmt = (v: number, money: boolean) => (money ? formatCurrency(v) : String(v));

  return (
    <div className="space-y-5">
      {/* Headline metrics */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium" />
              <th className="px-3 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-(--chart-1)" /> {monthLabel(a.key)}
                </span>
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-(--chart-2)" /> {monthLabel(b.key)}
                </span>
              </th>
              <th className="px-3 py-2 text-right font-medium">A vs B</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-t">
                <td className="px-3 py-2 text-muted-foreground">{m.label}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {fmt(m.a, m.money)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(m.b, m.money)}</td>
                <td className="px-3 py-2 text-right text-xs">
                  <DeltaBadge
                    delta={{
                      pct: pctChange(m.a, m.b),
                      text: fmt(Math.abs(m.a - m.b), m.money),
                      absolute: !m.money,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakdown */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Where the money went
          </span>
          <div className="inline-flex overflow-hidden rounded-md border text-xs">
            {(["main", "category"] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLevelChange(l)}
                className={cn(
                  "cursor-pointer px-2.5 py-1 transition-colors",
                  level === l
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l === "main" ? "Main categories" : "Categories"}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing in either month.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {level === "main" ? "Main category" : "Category"}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">{monthLabel(a.key, "short")}</th>
                  <th className="px-3 py-2 text-right font-medium">{monthLabel(b.key, "short")}</th>
                  <th className="px-3 py-2 text-right font-medium">A vs B</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: r.color }}
                        />
                        {r.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {r.a ? formatCurrency(r.a) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.b ? formatCurrency(r.b) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <DeltaBadge
                        delta={{
                          pct: pctChange(r.a, r.b),
                          text: formatCurrency(Math.abs(r.a - r.b)),
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthTable({
  months,
  byKey,
  a,
  b,
  onPick,
}: {
  months: MonthSummary[];
  byKey: Map<MonthKey, MonthSummary>;
  a: MonthKey | null;
  b: MonthKey | null;
  onPick: (k: MonthKey) => void;
}) {
  const max = Math.max(0, ...months.map((m) => m.total));
  const rows = [...months].reverse(); // newest first

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Month</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">vs previous</th>
            <th className="px-3 py-2 text-right font-medium">Expenses</th>
            <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Avg / expense</th>
            <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Top category</th>
            <th className="hidden w-40 px-4 py-2 lg:table-cell" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                No months in this range.
              </td>
            </tr>
          )}
          {rows.map((m) => {
            const prev = byKey.get(shiftMonth(m.key, -1));
            const top = m.byCategory[0];
            const isA = m.key === a;
            const isB = m.key === b;
            return (
              <tr
                key={m.key}
                onClick={() => onPick(m.key)}
                className={cn(
                  "cursor-pointer border-t transition-colors hover:bg-muted/30",
                  (isA || isB) && "bg-muted/40",
                )}
                title="Select as Month A"
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {monthLabel(m.key)}
                    {isA && <Tag color="var(--chart-1)">A</Tag>}
                    {isB && <Tag color="var(--chart-2)">B</Tag>}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {m.count ? (
                    formatCurrency(m.total)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-right text-xs sm:table-cell">
                  {m.count > 0 && prev ? (
                    <DeltaBadge
                      delta={{
                        pct: pctChange(m.total, prev.total),
                        text: formatCurrency(Math.abs(m.total - prev.total)),
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {m.count}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground md:table-cell">
                  {m.count ? formatCurrency(m.avg) : "—"}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {top ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: top.color }}
                      />
                      <span className="truncate">{top.name}</span>
                      <span className="tabular-nums">
                        {m.total ? Math.round((top.total / m.total) * 100) : 0}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-2 lg:table-cell">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-(--chart-1)"
                      style={{
                        width: max ? `${(m.total / max) * 100}%` : 0,
                        opacity: isA || isB ? 1 : 0.5,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[10px] font-bold text-background"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}
