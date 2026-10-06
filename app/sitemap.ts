import type { MetadataRoute } from "next";

import { getSiteSitemap } from "@/lib/site/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return getSiteSitemap(process.env.VERCEL_ENV);
}
