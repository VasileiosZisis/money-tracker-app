"use client";

import { useLayoutEffect } from "react";

import { mountHomepageMotion } from "./homepage-motion-controller";
import { mountHomepageNavigation } from "./homepage-navigation";

/** Progressive enhancement: server-rendered content is visible before and without JS. */
export function HomepageMotion() {
  useLayoutEffect(() => {
    const root = document.getElementById("homepage");
    if (!root) return;
    const stopMotion = mountHomepageMotion(root, window);
    const stopNavigation = mountHomepageNavigation(root, window);
    return () => {
      stopNavigation();
      stopMotion();
    };
  }, []);

  return null;
}
