import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { formatDisplayMoney, buildMoneyPresentation, buildChangeBars } from "./money";
import { calculateDemo } from "@/lib/demo/calculate";
import { createDemoSnapshot, DEMO_MONTH } from "@/lib/demo/fixtures";
import { defaultDemoSelection } from "@/lib/demo/selection";
import { transitionDemo } from "@/lib/demo/transitions";
import { watchWorkspaceDate } from "@/lib/dates/watch-workspace-date";
import { getAccountDateContext } from "@/lib/dates/time-zone";

test("display formatting preserves signs and nonzero changes below the currency unit", () => {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });
  assert.equal(formatDisplayMoney(formatter, "0", true, true), "€0.00");
  assert.equal(formatDisplayMoney(formatter, "-123.45", true, true), "-€123.45");
  assert.equal(formatDisplayMoney(formatter, "0.003", true, true), "+<€0.01");
  assert.equal(formatDisplayMoney(formatter, "-0.003", true, true), "−<€0.01");
  const display = buildMoneyPresentation({ change: "-0.003", percentage: "0.01" }, "EUR", true);
  assert.equal(display.signs["-0.003"], -1);
  assert.equal(display.percentages["0.01"], "+<0.1%");
  assert.equal(display.percentages["-0.003"], "−<0.1%");
  const scientific = buildMoneyPresentation({ changePercent: "1e-7", decrease: "-1e-7", note: "1e999999999999999999999" }, "EUR");
  assert.equal(scientific.percentages["1e-7"], "+<0.1%");
  assert.equal(scientific.percentages["-1e-7"], "−<0.1%");
  assert.equal(scientific.money["1e999999999999999999999"], undefined);
});

test("change bars are display-only, proportional, and preserve both directions", () => {
  const rows = [{ categoryId: "a", change: "-20.00" }, { categoryId: "b", change: "10.00" }, { categoryId: "c", change: "0.00" }];
  assert.deepEqual(buildChangeBars(rows), { a: { direction: -1, width: 100 }, b: { direction: 1, width: 50 }, c: { direction: 0, width: 0 } });
  assert.equal(rows[0].change, "-20.00");
});

test("demo presentation uses daily pace and real-app badges without changing totals", () => {
  const snapshot = createDemoSnapshot();
  const data = calculateDemo(snapshot, defaultDemoSelection);
  assert.equal(data.dashboard.income, "2800.00");
  assert.equal(data.dashboard.expense, "1190.15");
  assert.equal(data.dashboard.netLeft, "1609.85");
  const pace = data.metrics.find(metric => metric.title === "Spending pace")!;
  assert.match(pace.value, /\/day$/);
  assert.ok(!pace.value.includes("%"));
  assert.match(pace.badgeLabel!, /usual|baseline/);
  assert.equal(data.metrics[0].badgeVariant, "success");
  assert.equal(data.metrics[5].value, "86.2%");
  assert.equal(data.metrics[5].badgeVariant, "accent");
  const received = calculateDemo(transitionDemo(snapshot, { kind: "handle", templateId: "cdemofreelancetemplate", month: DEMO_MONTH, amount: "700.00", localDate: "2026-09-15", note: "" }), defaultDemoSelection);
  assert.equal(received.metrics[5].value, "107.7%");
  assert.equal(received.metrics[5].badgeVariant, "success");
  assert.equal(new Prisma.Decimal(data.dashboard.projectedNet).minus(data.dashboard.safeToSpend).toFixed(2), "450.00");
  const past = calculateDemo(snapshot, { ...defaultDemoSelection, month: "2026-08" });
  assert.equal(past.metrics[0].badgeLabel, undefined);
  assert.equal(past.metrics[2].badgeLabel, "Month complete");
  assert.equal(past.balance.endingBalance, data.balance.endingBalance);
  assert.deepEqual(JSON.parse(JSON.stringify(data.snapshot)), snapshot);
});

test("fixed demo calendar never reads today's date or installs midnight refresh", () => {
  const initialDateContext = getAccountDateContext("UTC", new Date("2026-09-15T12:00:00Z"));
  const stop = watchWorkspaceDate({ fixedCalendar: true, initialDateContext, timeZone: "UTC", onDateChange: () => assert.fail("fixed calendar changed"), readDateContext: () => { assert.fail("read real date"); }, scheduler: { setInterval: () => { assert.fail("installed timer"); }, clearInterval: () => assert.fail("cleared nonexistent timer") } });
  stop();
});

test("combined bill reserves always have a display label after undo", () => {
  const snapshot = transitionDemo(createDemoSnapshot(), { kind: "undo", templateId: "cdemorenttemplate", month: DEMO_MONTH });
  const data = calculateDemo(snapshot, defaultDemoSelection);
  assert.equal(data.reservedBills, "1020.00");
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });
  assert.equal(data.display.money[data.reservedBills], formatter.format(1020));
});

test("negative safe spend preserves its value and danger treatment", () => {
  const snapshot = transitionDemo(createDemoSnapshot(), { kind: "create", fields: { type: "EXPENSE", amount: "10000.00", localDate: "2026-09-15", categoryId: "cdemofoodcategory", subcategoryId: null, source: null, note: "" } });
  const data = calculateDemo(snapshot, defaultDemoSelection);
  assert.ok(new Prisma.Decimal(data.dashboard.safeToSpend).lt(0));
  assert.equal(data.metrics.find(metric => metric.title === "Safe to spend")?.tone, "danger");
  assert.equal(data.metrics.find(metric => metric.title === "Daily safe spend")?.tone, "danger");
});

test("real account midnight refresh remains account-local and cleans up its timer", () => {
  const initialDateContext = getAccountDateContext("Europe/Chisinau", new Date("2026-09-15T12:00:00Z"));
  let next = initialDateContext;
  let tick = () => {};
  let refreshes = 0;
  let cleared = false;
  const stop = watchWorkspaceDate({ fixedCalendar: false, initialDateContext, timeZone: "Europe/Chisinau", readDateContext: zone => { assert.equal(zone, "Europe/Chisinau"); return next; }, onDateChange: context => { refreshes++; assert.equal(context.localDate, "2026-09-16"); }, scheduler: { setInterval: (callback, delay) => { assert.equal(delay, 60000); tick = callback; return 7; }, clearInterval: id => { assert.equal(id, 7); cleared = true; } } });
  tick(); assert.equal(refreshes, 0);
  next = getAccountDateContext("Europe/Chisinau", new Date("2026-09-15T22:00:00Z"));
  tick(); tick(); assert.equal(refreshes, 1);
  stop(); assert.equal(cleared, true);
});
