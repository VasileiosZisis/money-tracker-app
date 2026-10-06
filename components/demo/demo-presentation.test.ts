import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceSidebar } from "@/components/app-shell/workspace-sidebar";
import { ContextBarView } from "@/components/app-shell/context-bar-view";
import { SidebarProvider } from "@/components/ui/sidebar";
import { FinancialRow } from "@/components/ui/financial-row";
import { demoNavItems } from "./navigation";
import { DemoDashboard } from "./dashboard";
import { DemoTransactions } from "./transactions";
import { DemoPlanned } from "./planned";
import { DemoInsights } from "./insights";
import { calculateDemo } from "@/lib/demo/calculate";
import { createDemoSnapshot, DEMO_INSTANT } from "@/lib/demo/fixtures";
import { defaultDemoSelection } from "@/lib/demo/selection";
import { getAccountDateContext } from "@/lib/dates/time-zone";

test("shared sidebar exposes only the four demo destinations and explicit active view", () => {
  const selection = { ...defaultDemoSelection, view: "planned" as const };
  const items = demoNavItems(selection);
  assert.deepEqual(items.map(item => item.view), ["dashboard", "transactions", "planned", "insights"]);
  assert.ok(items.every(item => item.href.startsWith("/demo")));
  const html = renderToStaticMarkup(createElement(SidebarProvider, null, createElement(WorkspaceSidebar, { items, homeHref: items[0].href, activeHref: items[2].href })));
  assert.match(html, /aria-current="page"/);
  assert.doesNotMatch(html, /href="\/(?:dashboard|transactions|planned|insights|categories|settings)(?:\?|"|\/)/);
  assert.doesNotMatch(html, /Open account menu|Sign out|>Settings</);
});

test("shared context bar presents the fixed example date and selected workspace", () => {
  const dateContext = getAccountDateContext("UTC", new Date(DEMO_INSTANT));
  const html = renderToStaticMarkup(createElement(SidebarProvider, null, createElement(ContextBarView, { pageLabel: "Insights", dateContext })));
  assert.match(html, /Current page: Insights/);
  assert.match(html, /datetime="2026-09-15"/i);
  assert.ok(html.includes(dateContext.dateLabel));
});

test("shared transaction rows preserve archived-category status and headings", () => {
  const props = { type: "EXPENSE" as const, category: "Groceries", dateLabel: "Sep 15, 2026", amount: "€20.00", heading: "h3" as const };
  const archived = renderToStaticMarkup(createElement(FinancialRow, { ...props, archived: true }));
  const active = renderToStaticMarkup(createElement(FinancialRow, props));
  assert.match(archived, /Archived category/);
  assert.match(archived, /<h3[^>]*>Groceries<\/h3>/);
  assert.doesNotMatch(active, /Archived category/);
});

test("all demo workspaces use shared sections and keep investigation links in the demo", () => {
  const data = calculateDemo(createDemoSnapshot(), { ...defaultDemoSelection, view: "insights", categoryId: "cdemofoodcategory" });
  const props = { data, busy: true, run: async () => false, navigate: async () => false };
  const dashboard = renderToStaticMarkup(createElement(DemoDashboard, props));
  const transactions = renderToStaticMarkup(createElement(DemoTransactions, props));
  const planned = renderToStaticMarkup(createElement(DemoPlanned, props));
  const insights = renderToStaticMarkup(createElement(DemoInsights, props));
  assert.match(dashboard, /Planning &amp; Forecast/);
  assert.match(dashboard, /Transactions &amp; Plans/);
  assert.match(dashboard, /\/day/);
  assert.match(transactions, /Transactions list/);
  assert.match(transactions, /<fieldset disabled=""/);
  assert.match(planned, /Planned items list/);
  assert.doesNotMatch(planned, /Add planned item|Activate|Deactivate|Save changes/);
  assert.match(insights, /Month outcomes/);
  assert.match(insights, /Monthly history/);
  assert.match(insights, /Year-over-year patterns/);
  for (const html of [dashboard, transactions, planned, insights]) {
    assert.doesNotMatch(html, /href="\/(?:dashboard|transactions|planned|insights|categories|settings)(?:\?|"|\/)/);
  }
});
