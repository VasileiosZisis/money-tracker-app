import assert from "node:assert/strict";
import test from "node:test";

import { mountHomepageMotion } from "./homepage-motion-controller";

class FakeStyle {
  values = new Map<string, string>();
  setProperty(name: string, value: string) { this.values.set(name, value); }
  getPropertyValue(name: string) { return this.values.get(name) ?? ""; }
  removeProperty(name: string) { const value = this.getPropertyValue(name); this.values.delete(name); return value; }
  get transform() { return this.getPropertyValue("transform"); }
  set transform(value: string) { this.setProperty("transform", value); }
}

function offset(element: FakeElement) {
  const match = element.style.transform.match(/translate3d\(0, ([\d.-]+)px, 0\)/);
  assert.ok(match);
  return Number(match[1]);
}

class FakeAnimation {
  onfinish: (() => void) | null = null;
  cancelled = false;
  cancel() { this.cancelled = true; }
  finish() { this.onfinish?.(); }
}

class FakeElement {
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  children = new Map<string, FakeElement[]>();
  listeners = new Map<string, (event: Event) => void>();
  animations: FakeAnimation[] = [];
  startStyles: string[] = [];
  constructor(public top = 0, public height = 400) {}
  getBoundingClientRect() { return { top: this.top, height: this.height }; }
  querySelectorAll(selector: string) { return this.children.get(selector) ?? []; }
  closest() { return this; }
  addEventListener(type: string, listener: (event: Event) => void) { this.listeners.set(type, listener); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  animate() {
    this.startStyles.push(this.style.getPropertyValue("opacity"));
    const animation = new FakeAnimation();
    this.animations.push(animation);
    return animation;
  }
}

class FakeMedia {
  listeners = new Set<() => void>();
  constructor(public matches: boolean) {}
  addEventListener(_type: string, listener: () => void) { this.listeners.add(listener); }
  removeEventListener(_type: string, listener: () => void) { this.listeners.delete(listener); }
  change(matches: boolean) { this.matches = matches; this.listeners.forEach((listener) => listener()); }
}

function fixture({ reduced = false, desktop = true, observer = true, animation = true, visibleTop = 100 } = {}) {
  const root = new FakeElement();
  const visible = new FakeElement(visibleTop);
  const offscreen = new FakeElement(1200);
  const scene = new FakeElement(800);
  const art = new FakeElement();
  const preview = new FakeElement();
  art.dataset.parallax = "1";
  preview.dataset.parallax = "-0.7";
  scene.children.set("[data-parallax]", [art, preview]);
  root.children.set("[data-reveal]", [visible, offscreen]);
  root.children.set(".home-scene", [scene]);
  const reducedMotion = new FakeMedia(reduced);
  const desktopMedia = new FakeMedia(desktop);
  const listeners = new Map<string, () => void>();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const observers: FakeObserver[] = [];

  class FakeObserver {
    targets = new Set<Element>();
    disconnected = false;
    constructor(private callback: IntersectionObserverCallback) { observers.push(this); }
    observe(element: Element) { this.targets.add(element); }
    unobserve(element: Element) { this.targets.delete(element); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    enter(element: FakeElement) {
      this.callback([{ target: element, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }

  const view = {
    innerHeight: 800,
    IntersectionObserver: observer ? FakeObserver : undefined,
    matchMedia: (query: string) => query.includes("reduced") ? reducedMotion : desktopMedia,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  if (!animation) Object.defineProperty(root, "animate", { value: undefined });
  const cleanup = mountHomepageMotion(root as unknown as HTMLElement, view as unknown as Parameters<typeof mountHomepageMotion>[1]);
  const flushFrame = () => { const callbacks = Array.from(frames.values()); frames.clear(); callbacks.forEach((callback) => callback(0)); };
  return { root, visible, offscreen, scene, art, preview, observers, reducedMotion, desktopMedia, listeners, frames, cleanup, flushFrame };
}

test("visible server content stays visible; offscreen content is hidden before its first reveal", () => {
  const f = fixture();
  assert.equal(f.visible.style.getPropertyValue("opacity"), "");
  assert.equal(f.visible.animations.length, 0);
  assert.equal(f.offscreen.style.getPropertyValue("opacity"), "0");
  assert.equal(f.offscreen.style.transform, "translateY(24px)");

  f.observers[0].enter(f.visible);
  f.observers[0].enter(f.offscreen);
  assert.equal(f.visible.animations.length, 0);
  assert.deepEqual(f.offscreen.startStyles, ["0"]);
  f.offscreen.animations[0].finish();
  assert.equal(f.offscreen.style.getPropertyValue("opacity"), "");
  assert.equal(f.offscreen.style.transform, "");
  assert.equal(f.offscreen.animations[0].cancelled, true);
  f.observers[0].enter(f.offscreen);
  assert.equal(f.offscreen.animations.length, 1);
  f.cleanup();
});

test("parallax has a continuous offset before artwork enters view and uses one frame per scroll batch", () => {
  const f = fixture();
  assert.equal(f.art.style.transform, "translate3d(0, -24px, 0)");
  assert.ok(Math.abs(offset(f.preview) - 16.8) < 0.01);
  const before = offset(f.art);
  f.scene.top = 799;
  f.listeners.get("scroll")?.();
  f.listeners.get("scroll")?.();
  assert.equal(f.frames.size, 1);
  f.flushFrame();
  assert.ok(Math.abs(offset(f.art) - before) < 1);
  f.scene.top = 600;
  f.listeners.get("scroll")?.();
  f.flushFrame();
  const middle = offset(f.art);
  f.scene.top = 599;
  f.listeners.get("scroll")?.();
  f.flushFrame();
  assert.ok(Math.abs(offset(f.art) - middle) < 1);
  f.scene.top = -1000;
  f.listeners.get("scroll")?.();
  f.flushFrame();
  assert.equal(f.art.style.transform, "translate3d(0, 24px, 0)");
  f.cleanup();
});

test("late hydration at a lower section never hides or reanimates content above the viewport", () => {
  const f = fixture({ visibleTop: -500 });
  assert.equal(f.visible.style.getPropertyValue("opacity"), "");
  assert.equal(f.visible.style.transform, "");
  assert.equal(f.observers[0].targets.has(f.visible as unknown as Element), false);
  f.observers[0].enter(f.visible);
  assert.equal(f.visible.animations.length, 0);
  f.cleanup();
});

test("crossing the mobile breakpoint disables parallax without restarting an active reveal", () => {
  const f = fixture();
  f.observers[0].enter(f.offscreen);
  f.desktopMedia.change(false);
  assert.equal(f.art.style.transform, "");
  assert.equal(f.preview.style.transform, "");
  assert.equal(f.offscreen.animations[0].cancelled, false);
  assert.equal(f.observers.length, 1);
  f.offscreen.animations[0].finish();
  f.desktopMedia.change(true);
  f.observers[0].enter(f.offscreen);
  assert.equal(f.offscreen.animations.length, 1);
  f.cleanup();
});

test("keyboard focus makes pending content visible immediately", () => {
  const f = fixture();
  f.root.listeners.get("focusin")?.({ target: f.offscreen } as unknown as Event);
  assert.equal(f.offscreen.style.getPropertyValue("opacity"), "");
  assert.equal(f.offscreen.style.transform, "");
  f.observers[0].enter(f.offscreen);
  assert.equal(f.offscreen.animations.length, 0);
  f.cleanup();
});

test("reduced motion restores pending content, cancels movement and does not replay visible content", () => {
  const f = fixture();
  f.observers[0].enter(f.offscreen);
  f.reducedMotion.change(true);
  assert.equal(f.offscreen.style.getPropertyValue("opacity"), "");
  assert.equal(f.offscreen.animations[0].cancelled, true);
  assert.equal(f.art.style.transform, "");
  f.reducedMotion.change(false);
  f.observers.at(-1)?.enter(f.offscreen);
  assert.equal(f.offscreen.animations.length, 1);
  f.cleanup();
});

test("unsupported animation APIs and initial reduced motion keep all content visible", () => {
  for (const options of [{ observer: false }, { animation: false }, { reduced: true }]) {
    const f = fixture(options);
    assert.equal(f.offscreen.style.getPropertyValue("opacity"), "");
    assert.equal(f.offscreen.style.transform, "");
    assert.equal(f.offscreen.animations.length, 0);
    f.cleanup();
  }
});

test("cleanup removes hidden styles, animations, observers, listeners and scheduled frames", () => {
  const f = fixture();
  f.observers[0].enter(f.offscreen);
  f.listeners.get("scroll")?.();
  f.cleanup();
  assert.equal(f.offscreen.style.getPropertyValue("opacity"), "");
  assert.equal(f.offscreen.style.transform, "");
  assert.equal(f.art.style.transform, "");
  assert.equal(f.offscreen.animations[0].cancelled, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.root.listeners.size, 0);
  assert.equal(f.desktopMedia.listeners.size, 0);
  assert.equal(f.reducedMotion.listeners.size, 0);
  assert.ok(f.observers.every((observer) => observer.disconnected));
});
