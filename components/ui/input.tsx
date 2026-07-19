import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-3 focus:ring-ring/70",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
