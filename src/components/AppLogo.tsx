import { cn } from "@/lib/utils";
import { useTheme, type ThemeId } from "@/lib/theme";

/** Each theme has its own coin (files live in /public). */
const LOGOS: Record<ThemeId, string> = {
  arcade: "/coin.png",
  basic: "/basic.png",
  grove: "/grov.png",
  medieval: "/med.png",
};

export function AppLogo({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={LOGOS[theme]}
      alt=""
      aria-hidden
      className={cn("coin-spin h-24 w-24 object-contain", className)}
    />
  );
}
