import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { SetupPreview } from "./setup-preview";
import { SetupScreen } from "./setup-screen";
import { SetupFields } from "./setup-fields";
import { TimeZoneSelect } from "../settings/time-zone-select";
import { allowedCurrencies } from "@/lib/validators/setup";

test("preview server HTML disables submission and never binds an account server action", () => {
  const html = renderToStaticMarkup(createElement(SetupPreview, { timeZones: ["UTC"] }));
  assert.match(html, /type="submit"[^>]*disabled/);
  assert.match(html, /Enable JavaScript to simulate setup/);
  assert.match(html, /value="EUR" selected/);
  assert.match(html, /name="createDefaults"[^>]*checked/);
  assert.doesNotMatch(html, /\$ACTION_|action="\/setup"/);
});

test("both shared variants retain their fields, form slot and accessible error notice", () => {
  for (const variant of ["first-time", "time-zone"] as const) {
    const fields = createElement(SetupFields, { variant, selectedCurrency: "USD", initialTimeZone: "UTC", timeZones: ["UTC"] });
    const html = renderToStaticMarkup(createElement(SetupScreen, { variant, errorMessage: "Example error", form: createElement("form", { action: "/example" }, fields) }));
    assert.match(html, /role="alert"/);
    assert.match(html, /Example error/);
    assert.match(html, /action="\/example"/);
    assert.match(html, /name="timeZone"/);
    if (variant === "first-time") {
      assert.match(html, /value="USD" selected/);
      assert.match(html, /name="createDefaults"/);
    } else {
      assert.doesNotMatch(html, /name="currency"|name="createDefaults"/);
    }
  }
});

test("setup fields preserve the complete currency list, default category choice and initial time zone", () => {
  const html = renderToStaticMarkup(createElement(SetupFields, {
    variant: "first-time", selectedCurrency: "CHF", initialTimeZone: "UTC", timeZones: ["Europe/London"],
  }));
  for (const currency of allowedCurrencies) assert.match(html, new RegExp(`value="${currency}"`));
  assert.match(html, /value="CHF" selected/);
  assert.match(html, /value="UTC" selected/);
  assert.match(html, /name="createDefaults"[^>]*checked/);
  assert.match(html, /id="currency"[^>]*aria-describedby="currency-description"/);
  assert.match(html, /id="currency-description"/);
  assert.match(html, /aria-describedby="timeZone-description"/);
  assert.match(html, /id="timeZone-description"/);
});

test("setup time-zone appearance preserves selection and Settings guidance remains unchanged", () => {
  const props = { id: "zone", name: "accountZone", initialTimeZone: "UTC", timeZones: ["Europe/London"] };
  const settingsHtml = renderToStaticMarkup(createElement(TimeZoneSelect, props));
  const setupHtml = renderToStaticMarkup(createElement(TimeZoneSelect, { ...props, appearance: "setup" }));
  for (const html of [settingsHtml, setupHtml]) {
    assert.match(html, /name="accountZone"/);
    assert.match(html, /value="UTC" selected/);
    assert.match(html, /required/);
    assert.match(html, /aria-describedby="zone-description"/);
  }
  assert.match(settingsHtml, /Confirm the time zone that should define your financial day\.<\/p>/);
  assert.doesNotMatch(settingsHtml, /setup-select/);
  assert.match(setupHtml, /Confirm the time zone that should define your financial day<\/p>/);
  assert.match(setupHtml, /setup-select/);
});

test("without browser detection the setup requires an explicit time-zone choice", () => {
  const html = renderToStaticMarkup(createElement(SetupFields, {
    variant: "time-zone", selectedCurrency: "EUR", initialTimeZone: null, timeZones: ["UTC"],
  }));
  assert.match(html, /value="" disabled="" selected=""/);
  assert.match(html, /name="timeZone"[^>]*required/);
  assert.doesNotMatch(html, /This device reports|name="currency"|name="createDefaults"/);
});

test("preview entry and shared UI remain separate from authenticated setup actions", () => {
  const paths = ["app/dev/setup/page.tsx", "components/setup/setup-preview.tsx", "components/setup/setup-screen.tsx", "components/setup/setup-fields.tsx", "components/setup/setup-frame.tsx", "lib/dev/setup-preview.ts"];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /from ["']@\/(?:actions\/setup|lib\/(?:auth|db))(?:[\/"'])/);
  }
  const page = readFileSync("app/dev/setup/page.tsx", "utf8");
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  assert.match(page, /isLocalPreviewEnabled\(process\.env\.NODE_ENV, process\.env\.VERCEL\)\) notFound\(\)/);
  assert.match(layout, /showDevelopment=\{isLocalPreviewEnabled\(process\.env\.NODE_ENV, process\.env\.VERCEL\)\}/);
});
