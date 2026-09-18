import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export type Delta = {
  /** Percent change, or null when the previous period had nothing to compare against. */
  pct: number | null;
  /** Absolute change, already formatted. */
  text: string;
  /** What we're comparing with, e.g. "Aug 2026". Omit to hide the "vs …" suffix. */
  vs?: string;
  /** Show the absolute change instead of the percentage (used for counts). */
  absolute?: boolean;
};

/** Past this, "+6354%" says less than "+€3,177" does. */
const PCT_DISPLAY_LIMIT = 1000;

/** "↗ 12% vs Aug 2026" — spending more than before reads as a warning, less as a win. */
export function DeltaBadge({ delta, className }: { delta: Delta; className?: string }) {
  if (delta.pct === null) {
    return (
      <span className={cn("text-muted-foreground/70", className)}>
        {delta.vs ? `no data for ${delta.vs}` : "—"}
      </span>
    );
  }
  const flat = Math.abs(delta.pct) < 0.5;
  const up = delta.pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const showAbsolute = delta.absolute || Math.abs(delta.pct) >= PCT_DISPLAY_LIMIT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        flat ? "text-muted-foreground" : up ? "text-destructive" : "text-primary",
        className,
      )}
      title={`${up ? "+" : "−"}${delta.text}${delta.vs ? ` vs ${delta.vs}` : ""}`}
    >
      <Icon className="h-3 w-3" />
      {flat ? "same" : showAbsolute ? delta.text : `${Math.abs(delta.pct).toFixed(0)}%`}
      {delta.vs && <span className="ml-1 font-normal text-muted-foreground">vs {delta.vs}</span>}
    </span>
  );
}
