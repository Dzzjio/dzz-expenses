import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCategories,
  fetchMainCategories,
  type CategoryWithMain,
  type MainCategory,
} from "@/lib/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryDialog } from "@/components/expense/CategoryDialog";
import { MainCategoryDialog } from "@/components/expense/MainCategoryDialog";
import { CategoryBadge } from "@/components/expense/CategoryBadge";

export const Route = createFileRoute("/manage-categories")({
  component: ManagePage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Manage categories — Spend" },
      { name: "description", content: "Manage main categories and categories for your expenses." },
      { property: "og:title", content: "Manage categories — Spend" },
      { property: "og:description", content: "Manage main categories and categories for your expenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ManagePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const { data: mains = [] } = useQuery({
    queryKey: ["main_categories", user?.id],
    queryFn: fetchMainCategories,
    enabled: !!user,
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: fetchCategories,
    enabled: !!user,
  });

  const catsByMain = useMemo(() => {
    const m = new Map<string, CategoryWithMain[]>();
    for (const c of cats) {
      const arr = m.get(c.main_category_id) ?? [];
      arr.push(c);
      m.set(c.main_category_id, arr);
    }
    return m;
  }, [cats]);

  const [mcOpen, setMcOpen] = useState(false);
  const [editMc, setEditMc] = useState<MainCategory | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<CategoryWithMain | null>(null);
  const [delMc, setDelMc] = useState<MainCategory | null>(null);
  const [delCat, setDelCat] = useState<CategoryWithMain | null>(null);

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) {
        // 23503 = foreign_key_violation: expenses still reference this category
        if (error.code === "23503") {
          throw new Error("This category still has expenses. Reassign them first.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDelCat(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMc = useMutation({
    mutationFn: async (m: MainCategory) => {
      const children = catsByMain.get(m.id) ?? [];
      if (children.length > 0) {
        throw new Error(
          `Reassign or delete ${children.length} categor${children.length === 1 ? "y" : "ies"} first.`,
        );
      }
      const { error } = await supabase.from("main_categories").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Main category deleted");
      qc.invalidateQueries({ queryKey: ["main_categories"] });
      setDelMc(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Manage categories
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditMc(null);
                setMcOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Main category
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditCat(null);
                setCatOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Category
            </Button>
          </div>
        </header>

        <div className="mt-6 space-y-4">
          {mains.length === 0 && (
            <p className="text-sm text-muted-foreground">No main categories yet.</p>
          )}
          {mains.map((m) => {
            const children = catsByMain.get(m.id) ?? [];
            return (
              <Card key={m.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span
                      className="h-3 w-3 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({children.length})
                    </span>
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditMc(m);
                        setMcOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDelMc(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {children.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No categories yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {children.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between py-2"
                        >
                          <CategoryBadge category={c} />
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditCat(c);
                                setCatOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDelCat(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <MainCategoryDialog
        open={mcOpen}
        onOpenChange={setMcOpen}
        mainCategory={editMc}
      />
      <CategoryDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        category={editCat}
      />

      <AlertDialog open={!!delMc} onOpenChange={(o) => !o && setDelMc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete main category?</AlertDialogTitle>
            <AlertDialogDescription>
              {delMc && (catsByMain.get(delMc.id)?.length ?? 0) > 0
                ? "This main category still has categories under it. Reassign or delete those first."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (delMc) deleteMc.mutate(delMc);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delCat} onOpenChange={(o) => !o && setDelCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Expenses using this category will need to be reassigned. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (delCat) deleteCat.mutate(delCat.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
