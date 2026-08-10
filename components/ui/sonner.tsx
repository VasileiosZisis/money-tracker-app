"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/components/theme/theme-store";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in srgb, var(--success) 12%, var(--popover))",
          "--success-border": "color-mix(in srgb, var(--success) 30%, var(--border))",
          "--success-text": "var(--success)",
          "--error-bg": "color-mix(in srgb, var(--destructive) 12%, var(--popover))",
          "--error-border": "color-mix(in srgb, var(--destructive) 30%, var(--border))",
          "--error-text": "var(--destructive)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-floating",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
