import type { ReactNode } from "react";

/**
 * Shared shell for Recharts tooltips. Uses the theme's popover tokens so the
 * card stays readable in both the arcade (dark) and basic (light) skins.
 */
export function ChartTooltipCard({ children }: { children: ReactNode }) {
  return (
    <div className="arcade-panel rounded-none border bg-popover px-3 py-2 text-xs text-popover-foreground [background-image:none]">
      {children}
    </div>
  );
}
