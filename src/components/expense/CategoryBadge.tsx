import type { Category } from "@/lib/expenses";

export function CategoryBadge({ category }: { category: Pick<Category, "name" | "color"> }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${category.color}18`,
        borderColor: `${category.color}55`,
        color: category.color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: category.color }}
      />
      {category.name}
    </span>
  );
}
