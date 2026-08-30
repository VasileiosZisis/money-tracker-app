"use client";

import { MoonStar, SunMedium } from "lucide-react";

import {
  setTheme,
  useTheme,
} from "@/components/theme/theme-store";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export function ThemeSettings() {
  const theme = useTheme();

  function handleThemeChange(values: string[]) {
    const nextTheme = values[0];

    if (nextTheme === "light" || nextTheme === "dark") {
      setTheme(nextTheme);
    }
  }

  return (
    <ToggleGroup
      aria-label="Theme"
      value={[theme]}
      onValueChange={handleThemeChange}
      variant="outline"
    >
      <ToggleGroupItem value="light" aria-label="Use light theme">
        <SunMedium />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Use dark theme">
        <MoonStar />
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
