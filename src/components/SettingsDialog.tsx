import { Link } from "@tanstack/react-router";
import { Check, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme, type ThemeId } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* Tiny swatch previews so each option reads at a glance */
const PREVIEWS: Record<ThemeId, React.ReactNode> = {
  arcade: (
    <div className="flex h-10 w-16 shrink-0 items-end gap-1 border-2 border-[oklch(0.42_0.11_291)] bg-[oklch(0.14_0.045_288)] p-1.5">
      <span className="h-3 w-3 bg-[oklch(0.85_0.21_141)]" />
      <span className="h-5 w-3 bg-[oklch(0.85_0.16_200)]" />
      <span className="h-4 w-3 bg-[oklch(0.72_0.28_340)]" />
    </div>
  ),
  basic: (
    <div className="flex h-10 w-16 shrink-0 items-end gap-1 rounded-md border border-[oklch(0.9_0.008_250)] bg-white p-1.5">
      <span className="h-3 w-3 rounded-sm bg-[oklch(0.55_0.2_262)]" />
      <span className="h-5 w-3 rounded-sm bg-[oklch(0.7_0.15_262)]" />
      <span className="h-4 w-3 rounded-sm bg-[oklch(0.85_0.06_262)]" />
    </div>
  ),
  grove: (
    <div className="relative flex h-10 w-16 shrink-0 items-end gap-1 overflow-hidden rounded-xl border border-[oklch(0.42_0.05_145)] bg-[oklch(0.2_0.035_155)] p-1.5">
      <span className="absolute right-2 top-1.5 h-1 w-1 rounded-full bg-[oklch(0.9_0.15_90)] shadow-[0_0_6px_2px_oklch(0.9_0.15_90/0.6)]" />
      <span className="h-3 w-3 rounded-full bg-[oklch(0.72_0.15_135)]" />
      <span className="h-5 w-3 rounded-full bg-[oklch(0.82_0.14_85)]" />
      <span className="h-4 w-3 rounded-full bg-[oklch(0.52_0.08_60)]" />
    </div>
  ),
};

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Pick how the app looks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Theme</Label>
          <div role="radiogroup" aria-label="Theme" className="grid gap-2">
            {themes.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "arcade-field flex w-full cursor-pointer items-center gap-3 border-2 p-3 text-left transition-colors focus-visible:outline-none",
                    active ? "border-ring" : "border-input hover:border-muted-foreground/60",
                  )}
                >
                  {PREVIEWS[t.id]}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center border-2",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                    aria-hidden
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/manage-categories" onClick={() => onOpenChange(false)}>
              <Tag className="mr-1.5 h-4 w-4" /> Manage categories
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
