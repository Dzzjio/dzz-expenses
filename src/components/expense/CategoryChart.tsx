import { useMemo } from "react";
import { X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ExpenseWithCategory } from "@/lib/expenses";
import { formatCurrency } from "@/lib/expenses";
import { cn } from "@/lib/utils";
import { ChartTooltipCard } from "./ChartTooltipCard";

type Slice = { id: string; name: string; value: number; color: string; mainId: string };
type MainGroup = Slice & { categories: Slice[] };

type TooltipPayload = { name: string; value: number; payload: Slice }[];

interface Props {
  expenses: ExpenseWithCategory[];
  /** Currently selected filters ("all" when none) so the legend can highlight them. */
  activeMain?: string;
  activeCategory?: string;
  onSelectMain?: (id: string) => void;
  onSelectCategory?: (id: string, mainId: string) => void;
}

function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: slice } = payload[0];
  return (
    <ChartTooltipCard>
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-background"
          style={{ backgroundColor: slice.color }}
        />
        <span className="font-medium text-popover-foreground">{name}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 tabular-nums">
        <span className="text-popover-foreground">{formatCurrency(value)}</span>
        <span className="text-muted-foreground">{pct(value, total)}%</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">Click to filter</div>
    </ChartTooltipCard>
  );
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

export function CategoryChart({
  expenses,
  activeMain = "all",
  activeCategory = "all",
  onSelectMain,
  onSelectCategory,
}: Props) {
  const { groups, outer, inner, total } = useMemo(() => {
    const mains = new Map<string, MainGroup>();
    let total = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      total += amt;
      const c = e.category;
      const mId = c?.main_category?.id ?? "none";
      const cId = c?.id ?? "none";

      const m =
        mains.get(mId) ??
        ({
          id: mId,
          mainId: mId,
          name: c?.main_category?.name ?? "Ungrouped",
          color: c?.main_category?.color ?? "#1f2937",
          value: 0,
          categories: [],
        } satisfies MainGroup);
      m.value += amt;
      mains.set(mId, m);

      let ci = m.categories.find((x) => x.id === cId);
      if (!ci) {
        ci = {
          id: cId,
          mainId: mId,
          name: c?.name ?? "Uncategorized",
          color: c?.color ?? "#6366f1",
          value: 0,
        };
        m.categories.push(ci);
      }
      ci.value += amt;
    }
    // Biggest first, in both the legend and the rings
    const groups = Array.from(mains.values()).sort((a, b) => b.value - a.value);
    for (const g of groups) g.categories.sort((a, b) => b.value - a.value);
    return {
      groups,
      outer: groups,
      inner: groups.flatMap((g) =>
        g.categories.map((c) => ({ ...c, name: `${g.name} · ${c.name}` })),
      ),
      total,
    };
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No expenses in this period yet.
      </p>
    );
  }

  const filtering = activeMain !== "all" || activeCategory !== "all";
  const clickable = !!(onSelectMain && onSelectCategory);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-64 w-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<SliceTooltip total={total} />} wrapperStyle={{ zIndex: 20 }} />
            <Pie
              data={outer}
              dataKey="value"
              nameKey="name"
              innerRadius="72%"
              outerRadius="95%"
              paddingAngle={1}
              stroke="var(--background)"
              strokeWidth={2}
              onClick={(d: Slice) => onSelectMain?.(d.id)}
            >
              {outer.map((s) => (
                <Cell key={s.id} fill={s.color} cursor={clickable ? "pointer" : undefined} />
              ))}
            </Pie>
            <Pie
              data={inner}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="70%"
              paddingAngle={1}
              stroke="var(--background)"
              strokeWidth={1}
              onClick={(d: Slice) => onSelectCategory?.(d.id, d.mainId)}
            >
              {inner.map((s) => (
                <Cell key={s.id} fill={s.color} cursor={clickable ? "pointer" : undefined} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Legend: main categories with their categories nested underneath */}
      <ul className="max-h-72 min-w-0 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
        {filtering && clickable && (
          <li>
            <button
              type="button"
              onClick={() => onSelectMain(activeMain !== "all" ? activeMain : "all")}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          </li>
        )}
        {groups.map((g) => (
          <li key={g.id}>
            <LegendRow
              slice={g}
              total={total}
              active={activeMain === g.id && activeCategory === "all"}
              strong
              onClick={clickable ? () => onSelectMain(g.id) : undefined}
            />
            <ul className="mt-1 space-y-0.5 border-l pl-3">
              {g.categories.map((c) => (
                <li key={c.id}>
                  <LegendRow
                    slice={c}
                    total={total}
                    active={activeCategory === c.id}
                    onClick={clickable ? () => onSelectCategory(c.id, c.mainId) : undefined}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegendRow({
  slice,
  total,
  active,
  strong,
  onClick,
}: {
  slice: Slice;
  total: number;
  active: boolean;
  strong?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left",
        onClick && "cursor-pointer hover:bg-muted/60",
        active && "bg-muted",
      )}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-background"
        style={{ backgroundColor: slice.color }}
      />
      <span className={cn("min-w-0 flex-1 truncate", strong ? "font-semibold" : "text-foreground")}>
        {slice.name}
      </span>
      <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(slice.value)}</span>
      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
        {pct(slice.value, total)}%
      </span>
    </Comp>
  );
}
