import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;
export type MainCategory = Tables<"main_categories">;
export type Expense = Tables<"expenses">;
export type CategoryWithMain = Category & { main_category: MainCategory | null };
export type ExpenseWithCategory = Expense & { category: CategoryWithMain | null };

export async function fetchMainCategories(): Promise<MainCategory[]> {
  const { data, error } = await supabase
    .from("main_categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategories(): Promise<CategoryWithMain[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, main_category:main_categories(*)")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CategoryWithMain[];
}

export async function fetchExpenses(): Promise<ExpenseWithCategory[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, category:categories(*, main_category:main_categories(*))")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExpenseWithCategory[];
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function randomColor() {
  const palette = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
    "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
    "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

export function randomDarkColor() {
  const palette = [
    "#0f172a", "#1e293b", "#334155", "#3f3f46", "#3f2d1d",
    "#5b21b6", "#7c2d12", "#134e4a", "#14532d", "#7f1d1d",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}
