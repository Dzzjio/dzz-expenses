import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ExpenseWithCategory } from "@/lib/expenses";
import { formatCurrency } from "@/lib/expenses";

type Slice = { name: string; value: number; color: string };

export function CategoryChart({ expenses }: { expenses: ExpenseWithCategory[] }) {
  const { outer, inner, total } = useMemo(() => {
    const mains = new Map<string, Slice>();
    const cats = new Map<string, Slice>();
    let total = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      total += amt;
      const c = e.category;
      const mId = c?.main_category?.id ?? "none";
      const mName = c?.main_category?.name ?? "Ungrouped";
      const mColor = c?.main_category?.color ?? "#1f2937";
      const cId = c?.id ?? "none";
      const cName = c?.name ?? "Uncategorized";
      const cColor = c?.color ?? "#6366f1";

      const m = mains.get(mId) ?? { name: mName, value: 0, color: mColor };
      m.value += amt;
      mains.set(mId, m);

      const ci = cats.get(cId) ?? { name: `${mName} · ${cName}`, value: 0, color: cColor };
      ci.value += amt;
      cats.set(cId, ci);
    }
    return {
      outer: Array.from(mains.values()),
      inner: Array.from(cats.values()),
      total,
    };
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No expenses this month yet.
      </p>
    );
  }

  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            formatter={(v: number, n: string) => [formatCurrency(v), n]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              fontSize: 12,
            }}
          />
          <Pie
            data={outer}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="95%"
            paddingAngle={1}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {outer.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Pie
            data={inner}
            dataKey="value"
            nameKey="name"
            innerRadius="45%"
            outerRadius="70%"
            paddingAngle={1}
            stroke="hsl(var(--background))"
            strokeWidth={1}
          >
            {inner.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
