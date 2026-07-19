"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const storageKey = "money-tracker-theme";
const themeChangeEvent = "money-tracker-theme-change";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }

  const domTheme = document.documentElement.dataset.theme;
  if (domTheme === "light" || domTheme === "dark") {
    return domTheme;
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : getSystemTheme();
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();

  window.addEventListener(themeChangeEvent, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(themeChangeEvent, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

type ThemeToggleProps = {
  variant?: "icon" | "sidebar";
};

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => "light");

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const icon =
    theme === "dark" ? <SunMedium className="size-[18px]" /> : <MoonStar className="size-[18px]" />;

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
