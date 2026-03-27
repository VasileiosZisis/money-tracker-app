import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  htmlFor: string;
  label: React.ReactNode;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
};

export function FormField({
  htmlFor,
  label,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>
      {children}
    </div>
  );
}
