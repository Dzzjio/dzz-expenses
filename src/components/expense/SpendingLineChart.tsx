import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ExpenseWithCategory } from "@/lib/expenses";
import { formatCurrency } from "@/lib/expenses";
import { ChartTooltipCard } from "./ChartTooltipCard";

interface Props {
  expenses: ExpenseWithCategory[];
  from: string;
  to: string;
  /** Name of the current period, for the legend. */
  label?: string;
  /** Previous period to overlay as a dashed line. Omit to hide the comparison. */
  compare?: { expenses: ExpenseWithCategory[]; from: string; to: string; label: string } | null;
}

type Bucket = "day" | "month";
type Point = { key: string; amount: number; prev?: number; prevKey?: string };

/** Local-time YYYY-MM-DD (toISOString would shift the day for anyone east of UTC). */
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseLocal(iso: string) {
  return new Date(iso + "T00:00:00");
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const start = parseLocal(from);
  const end = parseLocal(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const d = new Date(start);
  while (d <= end && out.length < 3660) {
    out.push(localISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function eachMonth(from: string, to: string): string[] {
  const out: string[] = [];
  const start = parseLocal(from);
  const end = parseLocal(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end && out.length < 600) {
    out.push(localISO(d).slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Ranges longer than ~3 months are summed per month so the line stays legible. */
const MONTHLY_THRESHOLD_DAYS = 100;

function daysBetween(from: string, to: string) {
  return (parseLocal(to).getTime() - parseLocal(from).getTime()) / 86_400_000;
}

/** Sum expenses into day or month buckets across a range, in order. */
function series(expenses: ExpenseWithCategory[], from: string, to: string, bucket: Bucket) {
  const keyOf = (date: string) => (bucket === "month" ? date.slice(0, 7) : date);
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.expense_date < from || e.expense_date > to) continue;
    const k = keyOf(e.expense_date);
    totals.set(k, (totals.get(k) ?? 0) + Number(e.amount));
  }
  const keys = bucket === "month" ? eachMonth(from, to) : eachDay(from, to);
  return keys.map((k) => ({ key: k, amount: totals.get(k) ?? 0 }));
}

export function SpendingLineChart({ expenses, from, to, label, compare }: Props) {
  const { data, bucket, hasCompare } = useMemo<{
    data: Point[];
    bucket: Bucket;
    hasCompare: boolean;
  }>(() => {
    const inRange = expenses.filter((e) => e.expense_date >= from && e.expense_date <= to);

    // Open-ended presets ("All time") pass sentinel bounds; clamp them to the
    // data we actually have, otherwise we'd plot thousands of empty days.
    let start = from;
    let end = to;
    const wide = daysBetween(from, to) > 3660;
    if (wide) {
      if (inRange.length === 0) return { data: [], bucket: "day", hasCompare: false };
      const dates = inRange.map((e) => e.expense_date).sort();
      start = dates[0];
      end = dates[dates.length - 1];
      const today = localISO(new Date());
      if (today > end) end = today;
    }

    const bucket: Bucket = daysBetween(start, end) > MONTHLY_THRESHOLD_DAYS ? "month" : "day";
    const current: Point[] = series(inRange, start, end, bucket);

    // Overlay the previous period aligned by position (day 1 ↔ day 1, Jan ↔ Jan).
    // A shorter previous period (e.g. February) simply leaves the tail empty.
    if (compare && !wide) {
      const prev = series(compare.expenses, compare.from, compare.to, bucket);
      current.forEach((p, i) => {
        if (prev[i]) {
          p.prev = prev[i].amount;
          p.prevKey = prev[i].key;
        }
      });
    }
    return { data: current, bucket, hasCompare: !!compare && !wide };
  }, [expenses, from, to, compare]);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No data for this date range.
      </p>
    );
  }

  const formatX = (k: string) =>
    bucket === "month"
      ? parseLocal(k + "-01").toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : parseLocal(k).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const formatLabel = (k: string) =>
    bucket === "month"
      ? parseLocal(k + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : parseLocal(k).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  return (
    <div>
      {hasCompare && compare && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-(--chart-1)" />
            {label ?? "This period"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="4" aria-hidden className="shrink-0">
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
            {compare.label}
          </span>
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="key"
              tickFormatter={formatX}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={40}
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
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "4 4",
                strokeOpacity: 0.6,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as Point;
                return (
                  <ChartTooltipCard>
                    <div className="text-muted-foreground">{formatLabel(point.key)}</div>
                    <div className="mt-1 font-medium tabular-nums text-popover-foreground">
                      {formatCurrency(point.amount)}
                    </div>
                    {point.prevKey !== undefined && point.prev !== undefined && (
                      <div className="mt-1.5 border-t border-border/60 pt-1.5 text-muted-foreground">
                        <div>{formatLabel(point.prevKey)}</div>
                        <div className="tabular-nums">{formatCurrency(point.prev)}</div>
                      </div>
                    )}
                  </ChartTooltipCard>
                );
              }}
            />
            {hasCompare && (
              <Line
                type="monotone"
                dataKey="prev"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                stroke: "var(--chart-1)",
                strokeWidth: 2,
                fill: "var(--background)",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
