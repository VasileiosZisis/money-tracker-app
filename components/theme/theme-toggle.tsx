"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { setTheme, useTheme } from "@/components/theme/theme-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  variant?: "icon" | "sidebar";
};

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const theme = useTheme();

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  const icon =
    theme === "dark" ? <SunMedium className="size-4.5" /> : <MoonStar className="size-4.5" />;

  if (variant === "sidebar") {
    return (
      <Button
        variant="ghost"
        onClick={toggleTheme}
        className={cn(
          "group/menu-button h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-1.5 text-sidebar-foreground shadow-none",
          "hover:bg-sidebar-accent hover:text-foreground",
        )}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        <span className="flex size-8 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground transition-colors group-hover/menu-button:text-foreground">
          {icon}
        </span>
        <span className="text-sm font-semibold">Theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="rounded-lg border-border/70 bg-card/80"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? <SunMedium /> : <MoonStar />}
    </Button>
  );
}
