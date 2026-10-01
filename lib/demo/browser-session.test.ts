import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_STORAGE_KEY, DemoRequestGate, readDemoStorage, restoreDemoData, settleDemoRequest, writeDemoStorage, type DemoResponse } from "./browser-session";
import { createDemoSnapshot } from "./fixtures";
import type { DemoSnapshot } from "./types";

function createStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

test("session edits restore across reloads, reset restores seed, and visitors remain separate", () => {
  const firstTab = createStorage();
  const secondTab = createStorage();
  const snapshot = createDemoSnapshot();
  snapshot.transactions[0].note = "My demo change";
  assert.equal(writeDemoStorage(firstTab, snapshot), true);
  assert.deepEqual(readDemoStorage(firstTab).snapshot, snapshot);
  assert.deepEqual(readDemoStorage(secondTab), {});
  assert.equal(writeDemoStorage(firstTab, createDemoSnapshot()), true);
  assert.deepEqual(readDemoStorage(firstTab).snapshot, createDemoSnapshot());
});

test("corrupt or oversized storage resets safely; unavailable storage uses memory", () => {
  const storage = createStorage();
  storage.setItem(DEMO_STORAGE_KEY, "bad JSON");
  assert.match(readDemoStorage(storage).notice!, /original sample/);
  assert.equal(storage.getItem(DEMO_STORAGE_KEY), null);
  storage.setItem(DEMO_STORAGE_KEY, "x".repeat(512_001));
  assert.match(readDemoStorage(storage).notice!, /original sample/);
  assert.match(readDemoStorage(null).notice!, /unavailable/);
  assert.equal(writeDemoStorage(null, createDemoSnapshot()), false);
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("denied"); } };
  assert.ok(readDemoStorage(denied).notice);
  assert.equal(writeDemoStorage(denied, createDemoSnapshot()), false);
});

test("reset and new requests invalidate pending restore and mutation responses", () => {
  const gate = new DemoRequestGate();
  const restore = gate.begin();
  const mutation = gate.begin();
  assert.equal(gate.accepts(restore), false);
  assert.equal(gate.accepts(mutation), true);
  gate.invalidate();
  assert.equal(gate.accepts(mutation), false);
  const reset = gate.begin();
  assert.equal(gate.accepts(reset), true);
  gate.invalidate();
  assert.equal(gate.accepts(reset), false);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("failed async restore keeps recoverable storage; invalid snapshots restore the seed", async () => {
  const storage = createStorage();
  const edits = createDemoSnapshot(); edits.transactions[0].note = "Keep this edit";
  writeDemoStorage(storage, edits);
  await assert.rejects(restoreDemoData(storage, createDemoSnapshot(), async () => { throw new Error("network failure"); }));
  assert.deepEqual(readDemoStorage(storage).snapshot, edits);
  const invalid = await restoreDemoData(storage, createDemoSnapshot(), async () => ({ ok: false, error: "Invalid snapshot" }));
  assert.deepEqual(invalid.data, createDemoSnapshot());
  assert.match(invalid.notice, /original sample/);
});

test("failed mutations do not replace accepted state or stored edits", async () => {
  const gate = new DemoRequestGate();
  const storage = createStorage();
  const edits = createDemoSnapshot(); edits.transactions[0].note = "Accepted edit";
  let accepted = edits; writeDemoStorage(storage, accepted);
  let error = "";
  let finished = 0;
  const callbacks = { accept(snapshot: DemoSnapshot) { accepted = snapshot; writeDemoStorage(storage, snapshot); }, error(message: string) { error = message; }, finished() { finished++; }, failureMessage: "Network failure" };
  assert.equal(await settleDemoRequest(gate, async () => ({ ok: false, error: "Invalid amount" }), callbacks), false);
  assert.equal(error, "Invalid amount");
  assert.equal(await settleDemoRequest(gate, async () => { throw new Error("offline"); }, callbacks), false);
  assert.equal(error, "Network failure");
  assert.equal(finished, 2);
  assert.deepEqual(accepted, edits);
  assert.deepEqual(readDemoStorage(storage).snapshot, edits);
});

test("late restore and mutation responses cannot overwrite reset state or storage", async () => {
  for (const requestKind of ["restore", "mutation"]) {
    const gate = new DemoRequestGate(); const storage = createStorage();
    const edits = createDemoSnapshot(); edits.transactions[0].note = "Stale edit";
    writeDemoStorage(storage, edits);
    let accepted = edits; let finished = 0; let errors = 0;
    const callbacks = { accept(snapshot: DemoSnapshot) { accepted = snapshot; writeDemoStorage(storage, snapshot); }, error() { errors++; }, finished() { finished++; }, failureMessage: "Failed" };
    const pending = deferred<DemoResponse<DemoSnapshot>>();
    const work = requestKind === "restore" ? async () => ({ ok: true as const, data: (await restoreDemoData(storage, createDemoSnapshot(), () => pending.promise)).data }) : () => pending.promise;
    const staleRequest = settleDemoRequest(gate, work, callbacks);
    const seed = createDemoSnapshot();
    assert.equal(await settleDemoRequest(gate, async () => ({ ok: true, data: seed }), callbacks), true);
    pending.resolve({ ok: true, data: edits });
    assert.equal(await staleRequest, false);
    assert.deepEqual(accepted, seed);
    assert.deepEqual(readDemoStorage(storage).snapshot, seed);
    assert.equal(finished, 1);
    assert.equal(errors, 0);
  }
});
