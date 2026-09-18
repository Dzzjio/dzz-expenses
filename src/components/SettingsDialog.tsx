import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronRight, Palette, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme, type ThemeId } from "@/lib/theme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Page = "main" | "theme";

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
  medieval: (
    <div className="relative flex h-10 w-16 shrink-0 items-end gap-1 border-[3px] border-double border-[oklch(0.55_0.07_65)] bg-[oklch(0.94_0.03_85)] p-1.5">
      <span className="absolute inset-x-1 top-1 h-px bg-[oklch(0.72_0.13_78)]" />
      <span className="h-3 w-3 bg-[oklch(0.46_0.17_25)]" />
      <span className="h-5 w-3 bg-[oklch(0.72_0.13_78)]" />
      <span className="h-4 w-3 bg-[oklch(0.3_0.045_45)]" />
    </div>
  ),
};

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { theme, setTheme, themes } = useTheme();
  const [page, setPage] = useState<Page>("main");

  // Always reopen on the main page
  useEffect(() => {
    if (open) setPage("main");
  }, [open]);

  const current = themes.find((t) => t.id === theme);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {page === "main" ? (
          <>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Tune how the app looks and works.</DialogDescription>
            </DialogHeader>

            <nav className="divide-y border">
              <SettingsRow
                icon={<Palette className="h-4 w-4" />}
                title="Theme"
                description={current ? `Currently ${current.name}` : "Pick how the app looks"}
                onClick={() => setPage("theme")}
              />
              <SettingsRow
                icon={<Tag className="h-4 w-4" />}
                title="Manage categories"
                description="Rename, recolour or remove categories"
                to="/manage-categories"
                onClick={() => onOpenChange(false)}
              />
            </nav>
          </>
        ) : (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setPage("main")}
                className="mb-1 inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Settings
              </button>
              <DialogTitle>Theme</DialogTitle>
              <DialogDescription>Pick how the app looks. Saved on this device.</DialogDescription>
            </DialogHeader>

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** One row in the settings list: icon, title, description, chevron. A `to` makes it a link. */
function SettingsRow({
  icon,
  title,
  description,
  onClick,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  to?: "/manage-categories";
}) {
  const className =
    "flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60";
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border bg-muted/40 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
