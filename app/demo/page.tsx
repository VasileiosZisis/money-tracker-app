import type { Metadata } from "next";

import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { calculateDemo } from "@/lib/demo/calculate";
import { createDemoSnapshot } from "@/lib/demo/fixtures";
import { normalizeDemoSelection } from "@/lib/demo/selection";

export const metadata: Metadata = {
  title: "Try the demo — CashContour",
  description: "Explore CashContour with fictional transactions, monthly plans, and spending history. No sign-in required.",
};

export default async function DemoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selection = normalizeDemoSelection(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  return <DemoWorkspace initialData={calculateDemo(createDemoSnapshot(), selection)} />;
}
