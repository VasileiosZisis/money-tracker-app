import type { Metadata, MetadataRoute } from "next";

export const SITE_NAME = "CashContour";
export const SITE_URL = "https://www.cashcontour.com";
export const SITE_DESCRIPTION =
  "Track income and expenses, plan monthly bills and income, and understand your spending history with CashContour.";

export const privateRobots = { index: false, follow: true };

const socialImage = {
  url: `${SITE_URL}/branding/cashcontour-social.png`,
  width: 1200,
  height: 630,
  alt: "CashContour logo on navy with the message: Your money. A clearer picture.",
};

// NODE_ENV is also production during preview builds; only Vercel Production is indexable.
export function getSiteMetadata(vercelEnvironment: string | undefined): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    robots: { index: vercelEnvironment === "production", follow: true },
  };
}

function publicPageMetadata(
  title: string,
  description: string,
  path: "/" | "/demo",
  absoluteTitle = false,
): Metadata {
  const url = new URL(path, SITE_URL).href;
  const socialTitle = absoluteTitle ? title : `${title} — ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: socialImage.url, alt: socialImage.alt }],
    },
  };
}

export const pageMetadata = {
  home: publicPageMetadata(
    "CashContour — Personal money tracking",
    "Record income and expenses, plan monthly bills, and understand your spending history in one calm workspace",
    "/",
    true,
  ),
  demo: publicPageMetadata(
    "Try the demo",
    "Explore CashContour with fictional transactions, monthly plans, and spending history. No sign-in required.",
    "/demo",
  ),
  login: {
    title: "Sign in",
    description: "Sign in to your personal money workspace",
    robots: privateRobots,
  },
  notFound: { title: { absolute: "Page not found — CashContour" } },
  dashboard: { title: "Dashboard" },
  transactions: { title: "Transactions" },
  insights: { title: "Insights" },
  categories: { title: "Categories" },
  planned: { title: "Planned" },
  settings: { title: "Settings" },
  setup: { title: "Setup" },
} satisfies Record<string, Metadata>;

export function getSiteRobots(vercelEnvironment: string | undefined): MetadataRoute.Robots {
  if (vercelEnvironment !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

export function getSiteSitemap(vercelEnvironment: string | undefined): MetadataRoute.Sitemap {
  return vercelEnvironment === "production"
    ? [{ url: `${SITE_URL}/` }, { url: `${SITE_URL}/demo` }]
    : [];
}
