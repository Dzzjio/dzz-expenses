import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { CategoryWithMain, ExpenseWithCategory } from "@/lib/expenses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryDialog } from "./CategoryDialog";

/** Local-time YYYY-MM-DD — toISOString() is UTC and gives yesterday's date before 04:00 in UTC+4. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: CategoryWithMain[];
  expense?: ExpenseWithCategory | null;
}

export function ExpenseDialog({ open, onOpenChange, categories, expense }: Props) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      if (expense) {
        setAmount(String(expense.amount));
        setDescription(expense.description ?? "");
        setCategoryId(expense.category_id);
        setDate(expense.expense_date);
      } else {
        setAmount("");
        setDescription("");
        setCategoryId(categories[0]?.id ?? "");
        setDate(today());
      }
    }
  }, [open, expense, categories]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; color: string; items: CategoryWithMain[] }>();
    for (const c of categories) {
      const key = c.main_category_id;
      const cur = map.get(key) ?? {
        name: c.main_category?.name ?? "Ungrouped",
        color: c.main_category?.color ?? "#1f2937",
        items: [],
      };
      cur.items.push(c);
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [categories]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        amount: Number(amount),
        description: description.trim() || null,
        category_id: categoryId,
        expense_date: date,
      };
      if (expense) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(expense ? "Expense updated" : "Expense added");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    amount !== "" && !Number.isNaN(Number(amount)) && Number(amount) > 0 && categoryId && date;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>
              Track a new spend to keep your budget on target.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="Optional note"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCatDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" /> New
                </Button>
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {grouped.map(([mid, g]) => (
                    <SelectGroup key={mid}>
                      <SelectLabel className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </SelectLabel>
                      {g.items.map((c) => (
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
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || mutation.isPending}>
                {mutation.isPending ? "Saving..." : expense ? "Update" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CategoryDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        onCreated={(id) => setCategoryId(id)}
      />
    </>
  );
}
