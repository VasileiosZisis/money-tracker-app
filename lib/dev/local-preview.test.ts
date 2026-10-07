import assert from "node:assert/strict";
import test from "node:test";
import { isLocalPreviewEnabled } from "./local-preview";

test("preview is available only for local development with VERCEL unset", () => {
  assert.equal(isLocalPreviewEnabled("development", undefined), true);
  for (const environment of ["production", "test", undefined]) {
    assert.equal(isLocalPreviewEnabled(environment, undefined), false);
  }
  for (const vercel of ["1", "", "0"]) {
    assert.equal(isLocalPreviewEnabled("development", vercel), false);
    assert.equal(isLocalPreviewEnabled("production", vercel), false);
  }
});
