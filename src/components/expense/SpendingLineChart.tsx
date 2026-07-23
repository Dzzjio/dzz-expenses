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

interface Props {
  expenses: ExpenseWithCategory[];
  from: string;
  to: string;
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  const d = new Date(start);
  while (d <= end && out.length < 3660) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function SpendingLineChart({ expenses, from, to }: Props) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (e.expense_date < from || e.expense_date > to) continue;
      totals.set(e.expense_date, (totals.get(e.expense_date) ?? 0) + Number(e.amount));
    }
    const days = eachDay(from, to);
    return days.map((d) => ({ date: d, amount: totals.get(d) ?? 0 }));
  }, [expenses, from, to]);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No data for this date range.
      </p>
    );
  }

  const formatX = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatX}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "#1f2937", strokeDasharray: "4 4", strokeOpacity: 0.5 }}
            formatter={(v: number) => [formatCurrency(v), "Spent"]}
            labelFormatter={(l: string) =>
              new Date(l + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            }
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              stroke: "#6366f1",
              strokeWidth: 2,
              fill: "#ffffff",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}