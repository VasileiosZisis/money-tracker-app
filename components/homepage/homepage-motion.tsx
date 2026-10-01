"use client";

import { useLayoutEffect } from "react";

import { mountHomepageMotion } from "./homepage-motion-controller";

/** Progressive enhancement: server-rendered content is visible before and without JS. */
export function HomepageMotion() {
  useLayoutEffect(() => {
    const root = document.getElementById("homepage");
    if (root) return mountHomepageMotion(root, window);
  }, []);

  return null;
}
