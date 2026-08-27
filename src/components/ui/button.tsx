import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pixel-press relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2 font-pixel uppercase tracking-[0.08em] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-arcade-ink bg-primary text-primary-foreground [--pixel-edge:var(--arcade-ink)] [--pixel-glow:var(--neon-lime)] hover:bg-neon-lime hover:brightness-110",
        destructive:
          "border-arcade-ink bg-destructive text-destructive-foreground [--pixel-edge:var(--arcade-ink)] [--pixel-glow:var(--destructive)] hover:brightness-115",
        outline:
          "arcade-field border-border text-neon-cyan [--pixel-edge:var(--arcade-edge)] [--pixel-glow:var(--neon-cyan)] hover:border-neon-cyan hover:text-neon-cyan hover:brightness-110",
        secondary:
          "border-arcade-edge bg-secondary text-secondary-foreground [--pixel-edge:var(--arcade-ink)] [--pixel-glow:var(--neon-violet)] hover:border-neon-violet",
        ghost:
          "border-transparent text-muted-foreground shadow-none [--pixel-edge:transparent] [--pixel-glow:var(--neon-cyan)] hover:border-border hover:bg-secondary/40 hover:text-neon-cyan",
        link: "border-transparent text-neon-cyan shadow-none underline-offset-4 [--pixel-edge:transparent] hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-[10px]",
        sm: "h-9 px-3 text-[9px]",
        lg: "h-12 px-8 text-xs",
        icon: "h-10 w-10 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
