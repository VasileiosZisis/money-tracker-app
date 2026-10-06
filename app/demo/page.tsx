import type { Metadata } from "next";

import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { calculateDemo } from "@/lib/demo/calculate";
import { createDemoSnapshot } from "@/lib/demo/fixtures";
import { normalizeDemoSelection } from "@/lib/demo/selection";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata: Metadata = pageMetadata.demo;

export default async function DemoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selection = normalizeDemoSelection(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  return <DemoWorkspace initialData={calculateDemo(createDemoSnapshot(), selection)} />;
}
