"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { setTheme, useTheme } from "@/components/theme/theme-store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const theme = useTheme();

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
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
