"use client";

import { useSyncExternalStore } from "react";

const storageKey = "money-tracker-theme";
const themeChangeEvent = "money-tracker-theme-change";

export type Theme = "light" | "dark";

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

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function useTheme(): Theme {
  return useSyncExternalStore<Theme>(subscribe, getThemeSnapshot, () => "light");
}
