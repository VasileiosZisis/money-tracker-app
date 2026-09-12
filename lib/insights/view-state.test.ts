import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompletedInsightsPeriodRange,
  getPreservedInsightsParams,
  type InsightsControlState,
} from "@/lib/insights/view-state";

const state: InsightsControlState = {
  period: 6,
  categoryId: "food",
  changeWindow: 1,
  changeMonth: "2026-07",
};

test("each Insights control preserves the other effective selections", () => {
  assert.deepEqual(getPreservedInsightsParams(state, "history"), {
    categoryId: "food",
    changeWindow: "1",
    changeMonth: "2026-07",
  });
  assert.deepEqual(getPreservedInsightsParams(state, "category"), {
    period: "6",
    changeWindow: "1",
    changeMonth: "2026-07",
  });
  assert.deepEqual(getPreservedInsightsParams(state, "drivers"), {
    period: "6",
    categoryId: "food",
  });
});

test("historical month selection is preserved only for month-to-month Drivers", () => {
  assert.deepEqual(
    getPreservedInsightsParams(
      { ...state, changeWindow: 3 },
      "history",
    ),
    {
      categoryId: "food",
      changeWindow: "3",
    },
  );
});

test("completed Insights ranges exclude the current month across year boundaries", () => {
  assert.deepEqual(getCompletedInsightsPeriodRange("2027-01", 3), {
    startMonth: "2026-10",
    endMonth: "2026-12",
  });
  assert.deepEqual(getCompletedInsightsPeriodRange("2027-01", 6), {
    startMonth: "2026-07",
    endMonth: "2026-12",
  });
  assert.deepEqual(getCompletedInsightsPeriodRange("2027-01", 12), {
    startMonth: "2026-01",
    endMonth: "2026-12",
  });
});
