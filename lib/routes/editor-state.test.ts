import assert from "node:assert/strict";
import test from "node:test";

import { buildEditorStateUrl } from "@/lib/routes/editor-state";

test("sets and replaces an editor query parameter while preserving the view", () => {
  assert.equal(
    buildEditorStateUrl(
      "https://example.test/transactions?month=2026-08&type=EXPENSE&categoryId=food",
      "edit",
      "transaction-2",
    ),
    "/transactions?month=2026-08&type=EXPENSE&categoryId=food&edit=transaction-2",
  );

  assert.equal(
    buildEditorStateUrl(
      "https://example.test/planned?type=BILL&status=inactive&edit=bill%3Aold",
      "edit",
      "income:new",
    ),
    "/planned?type=BILL&status=inactive&edit=income%3Anew",
  );
});

test("clears only the requested editor parameter", () => {
  assert.equal(
    buildEditorStateUrl(
      "https://example.test/dashboard?month=2026-08&balanceRange=year&balanceAdjustment=manage#balance",
      "balanceAdjustment",
    ),
    "/dashboard?month=2026-08&balanceRange=year#balance",
  );
});
