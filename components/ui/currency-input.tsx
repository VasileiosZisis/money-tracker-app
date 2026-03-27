import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & {
  currency: string;
  wrapperClassName?: string;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, currency, wrapperClassName, ...props }, ref) => (
    <div
      className={cn(
        "rounded-2xl border border-input bg-background/70 px-3.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-ring/70",
        wrapperClassName,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-muted-foreground">{currency}</span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          className={cn(
            "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
            className,
          )}
          {...props}
        />
      </div>
    </div>
  ),
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
