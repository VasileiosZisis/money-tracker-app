import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

function renderSidebar(open: boolean) {
  return renderToStaticMarkup(
    createElement(
      SidebarProvider,
      { open },
      createElement(Sidebar, null, createElement("a", { href: "/dashboard" }, "Dashboard")),
      createElement("main", null, createElement(SidebarTrigger)),
    ),
  );
}

function openingTag(markup: string, tag: string) {
  const match = markup.match(new RegExp(`<${tag}\\b[^>]*>`));
  assert.ok(match, `Expected rendered ${tag}`);
  return match[0];
}

test("hidden desktop navigation is inert while its external reopen control remains available", () => {
  const markup = renderSidebar(false);
  const sidebar = openingTag(markup, "aside");
  const trigger = openingTag(markup, "button");

  assert.doesNotMatch(sidebar, /\bhidden=""/);
  assert.match(sidebar, /\binert=""/);
  assert.match(sidebar, /aria-hidden="true"/);
  assert.match(sidebar, /\bw-0\b/);
  assert.match(trigger, /aria-label="Toggle navigation"/);
  assert.match(trigger, /aria-expanded="false"/);
  assert.doesNotMatch(trigger, /\b(?:hidden|inert|disabled)=""/);
  assert.ok(markup.indexOf("</aside>") < markup.indexOf("<main>"));
  assert.match(markup, /data-sidebar-open="false"/);
});

test("expanded desktop navigation is accessible and its toggle reflects the expanded state", () => {
  const markup = renderSidebar(true);
  const sidebar = openingTag(markup, "aside");

  assert.doesNotMatch(sidebar, /\b(?:hidden|inert)=""/);
  assert.match(sidebar, /aria-hidden="false"/);
  assert.match(sidebar, /lg:block/);
  assert.match(openingTag(markup, "button"), /aria-expanded="true"/);
  assert.match(markup, /data-sidebar-open="true"/);
});

test("default-closed navigation has the same focus protection as controlled closed navigation", () => {
  const markup = renderToStaticMarkup(
    createElement(
      SidebarProvider,
      { defaultOpen: false },
      createElement(Sidebar, null, createElement("a", { href: "/settings" }, "Settings")),
      createElement(SidebarTrigger),
    ),
  );

  assert.match(openingTag(markup, "aside"), /\binert=""/);
  assert.match(openingTag(markup, "aside"), /aria-hidden="true"/);
  assert.match(openingTag(markup, "button"), /aria-expanded="false"/);
});
