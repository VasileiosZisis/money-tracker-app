import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.02em]",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        accent: "border-primary/10 bg-accent text-accent-foreground",
        success: "border-success/10 bg-success/10 text-success",
        warning: "border-warning/10 bg-warning/10 text-warning",
        destructive: "border-destructive/10 bg-destructive/10 text-destructive",
        outline: "border-border/90 bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
