import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchMainCategories,
  randomColor,
  type CategoryWithMain,
} from "@/lib/expenses";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MainCategoryDialog } from "./MainCategoryDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category?: CategoryWithMain | null;
  onCreated?: (id: string) => void;
}

export function CategoryDialog({ open, onOpenChange, category, onCreated }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(randomColor());
  const [mainCategoryId, setMainCategoryId] = useState<string>("");
  const [mcOpen, setMcOpen] = useState(false);
  const qc = useQueryClient();

  const { data: mainCategories = [] } = useQuery({
    queryKey: ["main_categories"],
    queryFn: fetchMainCategories,
  });

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setColor(category?.color ?? randomColor());
      setMainCategoryId(category?.main_category_id ?? mainCategories[0]?.id ?? "");
    }
  }, [open, category, mainCategories]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (category) {
        const { data, error } = await supabase
          .from("categories")
          .update({ name: name.trim(), color, main_category_id: mainCategoryId })
          .eq("id", category.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: name.trim(), color, main_category_id: mainCategoryId } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(category ? "Category updated" : "Category added");
      qc.invalidateQueries({ queryKey: ["categories"] });
      onCreated?.(data.id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = name.trim() && mainCategoryId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Create a tag to group your expenses.</DialogDescription>
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
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coffee"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-main">Main category</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setMcOpen(true)}
                >
                  <Plus className="h-3 w-3" /> New
                </Button>
              </div>
              <Select value={mainCategoryId} onValueChange={setMainCategoryId}>
                <SelectTrigger id="cat-main">
                  <SelectValue placeholder="Select main category" />
                </SelectTrigger>
                <SelectContent>
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
            <div className="space-y-2">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="cat-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || !valid}>
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <MainCategoryDialog
        open={mcOpen}
        onOpenChange={setMcOpen}
        onCreated={(id) => setMainCategoryId(id)}
      />
    </>
  );
}
