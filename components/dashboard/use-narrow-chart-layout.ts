"use client";

import * as React from "react";

const NARROW_CHART_QUERY = "(max-width: 639px)";

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(NARROW_CHART_QUERY);

  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(NARROW_CHART_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useNarrowChartLayout() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
