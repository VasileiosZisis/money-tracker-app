import assert from "node:assert/strict";
import test from "node:test";
import { initialSetupPreviewState, setupPreviewReducer } from "./setup-preview";

function form(currency = "EUR", timeZone = "Europe/Chisinau", createDefaults = true) {
  const data = new FormData();
  data.set("currency", currency);
  data.set("timeZone", timeZone);
  if (createDefaults) data.set("createDefaults", "on");
  return data;
}

test("first-time preview validates currency and time zone with optional defaults", () => {
  for (const defaults of [true, false]) {
    const state = setupPreviewReducer(initialSetupPreviewState, { type: "submit", formData: form("USD", "UTC", defaults) });
    assert.equal(state.complete, true);
    assert.equal(state.errorMessage, undefined);
    assert.deepEqual(initialSetupPreviewState, { variant: "first-time", revision: 0, complete: false });
  }
  for (const invalid of [form("INVALID"), form("EUR", "invalid/zone"), form("EUR", "")]) {
    const state = setupPreviewReducer(initialSetupPreviewState, { type: "submit", formData: invalid });
    assert.equal(state.complete, false);
    assert.ok(state.errorMessage);
  }
});

test("time-zone-only preview does not require currency or category choices", () => {
  const initial = setupPreviewReducer(initialSetupPreviewState, { type: "variant", variant: "time-zone" });
  const data = new FormData();
  data.set("timeZone", "UTC");
  assert.equal(setupPreviewReducer(initial, { type: "submit", formData: data }).complete, true);
  data.set("timeZone", "invalid/zone");
  assert.equal(setupPreviewReducer(initial, { type: "submit", formData: data }).complete, false);
});

test("reset and version changes clear completion and errors and remount fields", () => {
  const complete = setupPreviewReducer(initialSetupPreviewState, { type: "submit", formData: form() });
  const error = setupPreviewReducer(complete, { type: "error" });
  assert.equal(error.complete, false);
  assert.ok(error.errorMessage);
  const reset = setupPreviewReducer(error, { type: "reset" });
  assert.deepEqual(reset, { variant: "first-time", revision: 1, complete: false });
  const changed = setupPreviewReducer(error, { type: "variant", variant: "time-zone" });
  assert.deepEqual(changed, { variant: "time-zone", revision: 1, complete: false });
  assert.equal(setupPreviewReducer(changed, { type: "reset" }).variant, "time-zone");
});
