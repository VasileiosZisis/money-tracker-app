type NavigationWindow = Pick<Window,
  "scrollY" | "scrollX" | "scrollTo" | "matchMedia" | "getComputedStyle" |
  "requestAnimationFrame" | "cancelAnimationFrame" | "addEventListener" |
  "removeEventListener" | "history" | "location"
>;

/** Animate explicit navigation clicks only; ordinary scrolling remains native. */
export function mountHomepageNavigation(root: HTMLElement, view: NavigationWindow) {
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.home-nav a[href^="#"]'));
  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const focusTargets = new Map<HTMLElement, string | null>();
  let frame: number | undefined;
  let destination: { target: HTMLElement; top: number } | undefined;

  const cancel = () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    frame = undefined;
    destination = undefined;
  };

  const finish = () => {
    if (!destination) return;
    const { target } = destination;
    destination = undefined;
    frame = undefined;
    // Match native anchor navigation's keyboard destination without another scroll.
    if (!focusTargets.has(target)) focusTargets.set(target, target.getAttribute("tabindex"));
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  const navigate = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.currentTarget as HTMLAnchorElement;
    const hash = link.getAttribute("href");
    if (!hash) return;
    const target = root.querySelector<HTMLElement>(hash);
    if (!target) return;
    event.preventDefault();
    cancel();
    const start = view.scrollY;
    const margin = parseFloat(view.getComputedStyle(target).scrollMarginTop) || 0;
    const top = Math.max(0, start + target.getBoundingClientRect().top - margin);
    destination = { target, top };
    if (view.location.hash !== hash) view.history.pushState(view.history.state, "", hash);
    if (reducedMotion.matches) {
      view.scrollTo({ top, left: view.scrollX, behavior: "instant" });
      finish();
      return;
    }
    let started: number | undefined;
    const step = (timestamp: number) => {
      started ??= timestamp;
      const progress = Math.min(1, (timestamp - started) / 800);
      const eased = 1 - Math.pow(1 - progress, 3);
      view.scrollTo({ top: start + (top - start) * eased, left: view.scrollX, behavior: "instant" });
      if (progress < 1) frame = view.requestAnimationFrame(step);
      else finish();
    };
    frame = view.requestAnimationFrame(step);
  };

  const changePreference = () => {
    if (!reducedMotion.matches || !destination) return;
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    view.scrollTo({ top: destination.top, left: view.scrollX, behavior: "instant" });
    finish();
  };
  const interruptions = ["wheel", "touchstart", "pointerdown", "keydown", "popstate"] as const;
  links.forEach(link => link.addEventListener("click", navigate));
  interruptions.forEach(type => view.addEventListener(type, cancel, { passive: true }));
  reducedMotion.addEventListener("change", changePreference);

  return () => {
    cancel();
    links.forEach(link => link.removeEventListener("click", navigate));
    interruptions.forEach(type => view.removeEventListener(type, cancel));
    reducedMotion.removeEventListener("change", changePreference);
    focusTargets.forEach((tabindex, target) => {
      if (tabindex === null) target.removeAttribute("tabindex");
      else target.setAttribute("tabindex", tabindex);
    });
  };
}
