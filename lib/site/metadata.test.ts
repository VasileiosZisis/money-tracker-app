import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveTitle } from "next/dist/lib/metadata/resolvers/resolve-title";

import robots from "../../app/robots";
import sitemap from "../../app/sitemap";

import {
  getSiteMetadata,
  getSiteRobots,
  getSiteSitemap,
  pageMetadata,
  privateRobots,
  SITE_URL,
} from "./metadata";

test("only Vercel Production allows indexing and advertises public URLs", () => {
  assert.deepEqual(getSiteMetadata("production").robots, { index: true, follow: true });
  assert.deepEqual(getSiteRobots("production"), {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://www.cashcontour.com/sitemap.xml",
  });
  assert.deepEqual(getSiteSitemap("production"), [
    { url: "https://www.cashcontour.com/" },
    { url: "https://www.cashcontour.com/demo" },
  ]);

  for (const environment of ["preview", "development", undefined, "", "unknown"]) {
    assert.deepEqual(getSiteMetadata(environment).robots, { index: false, follow: true });
    assert.deepEqual(getSiteRobots(environment), { rules: { userAgent: "*", disallow: "/" } });
    assert.deepEqual(getSiteSitemap(environment), []);
  }
});

test("robots and sitemap route handlers read the deployment environment", () => {
  const originalEnvironment = process.env.VERCEL_ENV;

  for (const environment of ["production", "preview", "development", undefined]) {
    try {
      if (environment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;

      if (environment === "production") {
        assert.deepEqual(robots(), {
          rules: { userAgent: "*", allow: "/", disallow: "/api/" },
          sitemap: "https://www.cashcontour.com/sitemap.xml",
        });
        assert.deepEqual(sitemap(), [
          { url: "https://www.cashcontour.com/" },
          { url: "https://www.cashcontour.com/demo" },
        ]);
      } else {
        assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });
        assert.deepEqual(sitemap(), []);
      }
    } finally {
      if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = originalEnvironment;
    }
  }
});

test("private pages stay noindex without blocking login crawling in production", () => {
  assert.deepEqual(privateRobots, { index: false, follow: true });
  assert.deepEqual(pageMetadata.login.robots, privateRobots);
  assert.equal(pageMetadata.home.robots, undefined);
  assert.equal(pageMetadata.demo.robots, undefined);
  assert.equal(getSiteMetadata("production").alternates, undefined);
});

test("public canonicals and sharing URLs use the official host and omit demo filters", () => {
  const metadataBase = getSiteMetadata("production").metadataBase;
  assert.ok(metadataBase instanceof URL);
  assert.equal(metadataBase.href, SITE_URL + "/");

  for (const [metadata, path] of [[pageMetadata.home, "/"], [pageMetadata.demo, "/demo"]] as const) {
    const expected = SITE_URL + path;
    assert.equal(metadata.alternates?.canonical, expected);
    assert.ok(metadata.openGraph && "url" in metadata.openGraph);
    assert.equal(metadata.openGraph.url, expected);
    assert.equal(metadata.openGraph.siteName, "CashContour");
    assert.ok("type" in metadata.openGraph);
    assert.equal(metadata.openGraph.type, "website");
    assert.ok(metadata.twitter && "card" in metadata.twitter);
    assert.equal(metadata.twitter.card, "summary_large_image");
    assert.equal(metadata.openGraph.description, metadata.description);
    assert.equal(metadata.twitter.description, metadata.description);
  }

  // Every URL-backed demo view is represented by one query-free canonical.
  for (const query of ["?view=insights&period=12", "?view=transactions&month=2026-08", "?view=planned&type=INCOME"]) {
    const incoming = new URL("/demo" + query, SITE_URL);
    assert.notEqual(incoming.href, pageMetadata.demo.alternates?.canonical);
    assert.equal(pageMetadata.demo.alternates?.canonical, SITE_URL + incoming.pathname);
  }
});

test("Next.js composes each page title with exactly one brand suffix", () => {
  const root = resolveTitle(getSiteMetadata("production").title, null);
  assert.equal(root.absolute, "CashContour");
  const expected = {
    home: "CashContour — Personal money tracking",
    demo: "Try the demo — CashContour",
    login: "Sign in — CashContour",
    notFound: "Page not found — CashContour",
    dashboard: "Dashboard — CashContour",
    transactions: "Transactions — CashContour",
    insights: "Insights — CashContour",
    categories: "Categories — CashContour",
    planned: "Planned — CashContour",
    settings: "Settings — CashContour",
    setup: "Setup — CashContour",
  };

  for (const [key, title] of Object.entries(expected)) {
    const metadata = pageMetadata[key as keyof typeof pageMetadata];
    assert.equal(resolveTitle(metadata.title, root.template).absolute, title);
  }
  assert.equal(pageMetadata.home.openGraph?.title, expected.home);
  assert.equal(pageMetadata.demo.openGraph?.title, expected.demo);
  assert.equal(pageMetadata.home.twitter?.title, expected.home);
  assert.equal(pageMetadata.demo.twitter?.title, expected.demo);
});

test("the shared preview image exists as a 1200 by 630 PNG with descriptive alt text", () => {
  const images = pageMetadata.home.openGraph?.images;
  assert.ok(Array.isArray(images));
  const image = images[0];
  assert.ok(image && typeof image === "object" && "url" in image && "width" in image);
  assert.equal(image.url, SITE_URL + "/branding/cashcontour-social.png");
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.match(image.alt ?? "", /CashContour.*Your money\. A clearer picture\./);
  assert.deepEqual(pageMetadata.demo.openGraph?.images, images);
  assert.deepEqual(pageMetadata.home.twitter?.images, pageMetadata.demo.twitter?.images);

  const png = readFileSync(new URL("../../public/branding/cashcontour-social.png", import.meta.url));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
