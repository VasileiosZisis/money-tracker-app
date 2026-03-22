import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-floating hover:bg-primary/92",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/85",
        outline:
          "border border-border bg-card text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-secondary/70",
        ghost: "text-muted-foreground hover:bg-secondary/75 hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-floating hover:bg-destructive/92",
        success:
          "bg-success text-success-foreground shadow-floating hover:bg-success/92",
      },
      size: {
        sm: "h-9 px-3.5",
        default: "h-10 px-4",
        lg: "h-11 px-5 text-[0.95rem]",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
