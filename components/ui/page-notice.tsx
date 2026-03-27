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
        "rounded-[24px] border p-5",
        variant === "error"
          ? "border-destructive/20 bg-destructive/5"
          : "border-success/20 bg-success/5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl",
            variant === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-success/10 text-success",
          )}
        >
          <Icon className="size-[18px]" />
        </div>
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
          <div className="text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
