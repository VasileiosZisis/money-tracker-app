import type * as React from "react";
import { CircleAlert, CircleCheckBig } from "lucide-react";

import { cn } from "@/lib/utils";

type PageNoticeProps = {
  variant: "error" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function PageNotice({
  variant,
  title,
  children,
  className,
}: PageNoticeProps) {
  const Icon = variant === "error" ? CircleAlert : CircleCheckBig;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        variant === "error"
          ? "border-destructive/20 bg-destructive/5"
          : "border-success/20 bg-success/5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            variant === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-success/10 text-success",
          )}
        >
          <Icon className="size-4.5" />
        </div>
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
          <div className="text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
