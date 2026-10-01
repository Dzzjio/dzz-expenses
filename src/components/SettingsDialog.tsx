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
  pirate: (
    <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded border border-[oklch(0.55_0.12_72)] bg-[linear-gradient(180deg,oklch(0.23_0.035_56),oklch(0.15_0.026_52))] shadow-[inset_0_0_0_2px_oklch(0.1_0.02_55/0.6),inset_0_0_0_3px_oklch(0.8_0.15_80/0.3)]">
      <svg viewBox="0 0 64 40" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="pirate-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e08a" />
            <stop offset=".5" stopColor="#c8962c" />
            <stop offset="1" stopColor="#7a5014" />
          </linearGradient>
        </defs>
        {[7, 17, 27, 37, 47, 57].map((x) => (
          <g key={x}>
            <ellipse
              cx={x}
              cy="4"
              rx="3.4"
              ry="1.9"
              fill="none"
              stroke="url(#pirate-gold)"
              strokeWidth="1"
            />
            <ellipse
              cx={x}
              cy="36"
              rx="3.4"
              ry="1.9"
              fill="none"
              stroke="url(#pirate-gold)"
              strokeWidth="1"
            />
          </g>
        ))}
        <g stroke="url(#pirate-gold)" strokeWidth="2.6" strokeLinecap="round">
          <line x1="22" y1="12" x2="42" y2="29" />
          <line x1="42" y1="12" x2="22" y2="29" />
        </g>
        <path
          d="M32 8c-5.2 0-8.6 3.4-8.6 7.8 0 2.7 1.2 4.4 2.8 5.5V25h11.6v-3.7c1.6-1.1 2.8-2.8 2.8-5.5C40.6 11.4 37.2 8 32 8z"
          fill="url(#pirate-gold)"
          stroke="#2a1a06"
          strokeWidth=".8"
        />
        <circle cx="28.6" cy="16.2" r="2.1" fill="#1a0f04" />
        <circle cx="35.4" cy="16.2" r="2.1" fill="#1a0f04" />
        <path d="M32 18.6l-1.3 3h2.6z" fill="#1a0f04" />
        <path
          d="M28.8 25v-2.2m2.4 2.2v-2.2m2.4 2.2v-2.2m2.4 2.2v-2.2"
          stroke="#2a1a06"
          strokeWidth=".7"
        />
      </svg>
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
