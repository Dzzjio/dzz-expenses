import type { ExpenseWithCategory } from "@/lib/expenses";

/** "YYYY-MM" */
export type MonthKey = string;

export type Breakdown = { id: string; name: string; color: string; total: number; count: number };

export interface MonthSummary {
  key: MonthKey;
  total: number;
  count: number;
  avg: number;
  /** Largest single expense in the month */
  max: number;
  /** Spend per main category, biggest first */
  byMain: Breakdown[];
  /** Spend per category, biggest first */
  byCategory: Breakdown[];
}

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: MonthKey, style: "long" | "short" = "long") {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
  });
}

export function shiftMonth(key: MonthKey, by: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + by, 1));
}

/** Every month from `from` to `to` inclusive, ascending. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let k = from;
  while (k <= to && out.length < 600) {
    out.push(k);
    k = shiftMonth(k, 1);
  }
  return out;
}

function addTo(map: Map<string, Breakdown>, id: string, name: string, color: string, amt: number) {
  const b = map.get(id) ?? { id, name, color, total: 0, count: 0 };
  b.total += amt;
  b.count += 1;
  map.set(id, b);
}

const byTotal = (a: Breakdown, b: Breakdown) => b.total - a.total;

/**
 * Roll expenses up per month. Months in `months` with no expenses still get a
 * (zeroed) entry so gaps show up in charts and tables.
 */
export function summarizeMonths(
  expenses: ExpenseWithCategory[],
  months: MonthKey[],
): MonthSummary[] {
  const wanted = new Set(months);
  const acc = new Map<
    MonthKey,
    {
      total: number;
      count: number;
      max: number;
      mains: Map<string, Breakdown>;
      cats: Map<string, Breakdown>;
    }
  >();
  for (const k of months) {
    acc.set(k, { total: 0, count: 0, max: 0, mains: new Map(), cats: new Map() });
  }

  for (const e of expenses) {
    const k = e.expense_date.slice(0, 7);
    if (!wanted.has(k)) continue;
    const a = acc.get(k)!;
    const amt = Number(e.amount);
    a.total += amt;
    a.count += 1;
    if (amt > a.max) a.max = amt;
    const c = e.category;
    addTo(
      a.mains,
      c?.main_category?.id ?? "none",
      c?.main_category?.name ?? "Ungrouped",
      c?.main_category?.color ?? "#1f2937",
      amt,
    );
    addTo(a.cats, c?.id ?? "none", c?.name ?? "Uncategorized", c?.color ?? "#6366f1", amt);
  }

  return months.map((key) => {
    const a = acc.get(key)!;
    return {
      key,
      total: a.total,
      count: a.count,
      avg: a.count > 0 ? a.total / a.count : 0,
      max: a.max,
      byMain: [...a.mains.values()].sort(byTotal),
      byCategory: [...a.cats.values()].sort(byTotal),
    };
  });
}

/** Percent change from `previous` to `current`; null when there's nothing to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Line up two months' breakdowns so every category appearing in either shows
 * once, with both amounts. Sorted by the larger of the two.
 */
export function alignBreakdowns(a: Breakdown[], b: Breakdown[]) {
  const ids = new Map<string, { id: string; name: string; color: string; a: number; b: number }>();
  for (const x of a) ids.set(x.id, { id: x.id, name: x.name, color: x.color, a: x.total, b: 0 });
  for (const x of b) {
    const cur = ids.get(x.id);
    if (cur) cur.b = x.total;
    else ids.set(x.id, { id: x.id, name: x.name, color: x.color, a: 0, b: x.total });
  }
  return [...ids.values()].sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
}
