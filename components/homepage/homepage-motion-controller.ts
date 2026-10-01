type MotionWindow = Pick<Window,
  "innerHeight" | "matchMedia" | "requestAnimationFrame" | "cancelAnimationFrame" | "addEventListener" | "removeEventListener"
> & { IntersectionObserver: typeof IntersectionObserver };

/** Enhance only offscreen content: never hide HTML the visitor has already seen. */
export function mountHomepageMotion(root: HTMLElement, view: MotionWindow) {
  if (typeof view.IntersectionObserver !== "function") return () => {};

  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = view.matchMedia("(min-width: 768px)");
  const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  const scenes = Array.from(root.querySelectorAll<HTMLElement>(".home-scene"), (scene) => ({
    scene,
    layers: Array.from(scene.querySelectorAll<HTMLElement>("[data-parallax]")),
  }));
  const seen = new Set<HTMLElement>();
  const pending = new Set<HTMLElement>();
  const animations = new Map<HTMLElement, Animation>();
  let observer: IntersectionObserver | undefined;
  let frame: number | undefined;

  const show = (element: HTMLElement) => {
    pending.delete(element);
    element.style.removeProperty("opacity");
    element.style.removeProperty("transform");
  };

  const finishReveal = (element: HTMLElement) => {
    seen.add(element);
    observer?.unobserve(element);
    // Restore the visible base style before removing the animation's final frame.
    show(element);
    const animation = animations.get(element);
    if (animation) {
      animation.onfinish = null;
      animation.cancel();
      animations.delete(element);
    }
  };

  const stopReveals = () => {
    observer?.disconnect();
    observer = undefined;
    Array.from(pending).forEach(show);
    animations.forEach((animation) => {
      animation.onfinish = null;
      animation.cancel();
    });
    animations.clear();
  };

  const prepareReveals = () => {
    stopReveals();
    if (reducedMotion.matches) {
      reveals.forEach((element) => seen.add(element));
      return;
    }
    if (typeof root.animate !== "function") return;

    observer = new view.IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        const element = target as HTMLElement;
        if (!isIntersecting || seen.has(element) || !pending.has(element)) return;
        seen.add(element);
        observer?.unobserve(element);
        try {
          const animation = element.animate(
            [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 650, delay: Number(element.dataset.delay ?? 0), easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
          );
          animations.set(element, animation);
          animation.onfinish = () => finishReveal(element);
        } catch {
          finishReveal(element);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px 24px 0px" });

    // Hydration can follow the first server paint. Leave visible/passed content alone.
    const positions = reveals.map((element) => ({ element, top: element.getBoundingClientRect().top }));
    positions.forEach(({ element, top }) => {
      if (seen.has(element)) return;
      if (top < view.innerHeight) {
        seen.add(element);
        return;
      }
      pending.add(element);
      element.style.setProperty("opacity", "0");
      element.style.setProperty("transform", "translateY(24px)");
      observer?.observe(element);
    });
  };

  const resetParallax = () => {
    scenes.forEach(({ layers }) => layers.forEach((layer) => layer.style.removeProperty("transform")));
  };

  const updateParallax = () => {
    frame = undefined;
    if (reducedMotion.matches || !desktop.matches) return;
    // Initialize every scene, including offscreen ones, so entering view adds no offset jump.
    const positions = scenes.map(({ scene, layers }) => {
      const bounds = scene.getBoundingClientRect();
      const progress = (view.innerHeight / 2 - bounds.top - bounds.height / 2) /
        (view.innerHeight / 2 + bounds.height / 2);
      return { layers, offset: Math.max(-24, Math.min(24, progress * 24)) };
    });
    positions.forEach(({ layers, offset }) => layers.forEach((layer) => {
      layer.style.transform = `translate3d(0, ${offset * Number(layer.dataset.parallax)}px, 0)`;
    }));
  };

  const cancelFrame = () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    frame = undefined;
  };

  const configureParallax = () => {
    cancelFrame();
    if (reducedMotion.matches || !desktop.matches) resetParallax();
    else updateParallax();
  };

  const scheduleParallax = () => {
    if (!reducedMotion.matches && desktop.matches && frame === undefined) frame = view.requestAnimationFrame(updateParallax);
  };

  const changeMotionPreference = () => {
    prepareReveals();
    configureParallax();
  };

  const revealFocusedContent = (event: Event) => {
    const element = (event.target as Element | null)?.closest<HTMLElement>("[data-reveal]");
    if (element && pending.has(element)) finishReveal(element);
  };

  prepareReveals();
  configureParallax();
  root.addEventListener("focusin", revealFocusedContent);
  view.addEventListener("scroll", scheduleParallax, { passive: true });
  view.addEventListener("resize", scheduleParallax);
  reducedMotion.addEventListener("change", changeMotionPreference);
  desktop.addEventListener("change", configureParallax);

  return () => {
    stopReveals();
    cancelFrame();
    resetParallax();
    root.removeEventListener("focusin", revealFocusedContent);
    view.removeEventListener("scroll", scheduleParallax);
    view.removeEventListener("resize", scheduleParallax);
    reducedMotion.removeEventListener("change", changeMotionPreference);
    desktop.removeEventListener("change", configureParallax);
  };
}
