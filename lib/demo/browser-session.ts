import type { DemoSnapshot } from "./types";

export const DEMO_STORAGE_KEY = "cashcontour-demo-v1";
type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readDemoStorage(storage: DemoStorage | null): { snapshot?: unknown; notice?: string } {
  if (!storage) return { notice: "Browser storage is unavailable. Demo edits will last until you reload this page." };
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return {};
    if (raw.length > 512_000) throw new Error("Stored demo is too large.");
    return { snapshot: JSON.parse(raw) as unknown };
  } catch {
    try { storage.removeItem(DEMO_STORAGE_KEY); } catch { /* In-memory fallback still works. */ }
    return { notice: "Stored demo data could not be restored. The original sample has been loaded." };
  }
}

export function writeDemoStorage(storage: DemoStorage | null, snapshot: DemoSnapshot): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

// Reset/unmount invalidates any outstanding restore, filter, or mutation response.
export class DemoRequestGate {
  private generation = 0;
  begin() { return ++this.generation; }
  accepts(generation: number) { return generation === this.generation; }
  invalidate() { this.generation++; }
}

export type DemoResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export async function restoreDemoData<T>(storage: DemoStorage | null, initialData: T,
  validate: (snapshot: unknown) => Promise<DemoResponse<T>>,
): Promise<{ data: T; notice: string }> {
  const stored = readDemoStorage(storage);
  if (stored.snapshot === undefined) return { data: initialData, notice: stored.notice ?? "" };
  // Transport failures propagate without discarding recoverable stored edits.
  const response = await validate(stored.snapshot);
  return response.ok ? { data: response.data, notice: stored.notice ?? "" }
    : { data: initialData, notice: "Stored demo data is invalid or from an older version. The original sample has been loaded." };
}

export async function settleDemoRequest<T>(gate: DemoRequestGate, work: () => Promise<DemoResponse<T>>, callbacks: {
  accept: (data: T) => void;
  error: (message: string) => void;
  finished: () => void;
  failureMessage: string;
}): Promise<boolean> {
  const generation = gate.begin();
  try {
    const response = await work();
    if (!gate.accepts(generation)) return false;
    if (!response.ok) { callbacks.error(response.error); return false; }
    callbacks.accept(response.data);
    return true;
  } catch {
    if (gate.accepts(generation)) callbacks.error(callbacks.failureMessage);
    return false;
  } finally {
    if (gate.accepts(generation)) callbacks.finished();
  }
}
