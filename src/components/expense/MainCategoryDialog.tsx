import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { MainCategory } from "@/lib/expenses";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mainCategory?: MainCategory | null;
  onCreated?: (id: string) => void;
}

export function MainCategoryDialog({ open, onOpenChange, mainCategory, onCreated }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1f2937");
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(mainCategory?.name ?? "");
      setColor(mainCategory?.color ?? "#1f2937");
    }
  }, [open, mainCategory]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mainCategory) {
        const { data, error } = await supabase
          .from("main_categories")
          .update({ name: name.trim(), color })
          .eq("id", mainCategory.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("main_categories")
        .insert({ name: name.trim(), color } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(mainCategory ? "Main category updated" : "Main category added");
      qc.invalidateQueries({ queryKey: ["main_categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      onCreated?.(data.id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mainCategory ? "Edit main category" : "New main category"}</DialogTitle>
          <DialogDescription>Main categories group related categories together.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="mc-name">Name</Label>
            <Input
              id="mc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Essentials"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mc-color">Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="mc-color"
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
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
