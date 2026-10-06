import type { MetadataRoute } from "next";

import { getSiteRobots } from "@/lib/site/metadata";

export default function robots(): MetadataRoute.Robots {
  return getSiteRobots(process.env.VERCEL_ENV);
}
