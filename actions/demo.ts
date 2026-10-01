"use server";

import { z } from "zod";
import { calculateDemo, type DemoData } from "@/lib/demo/calculate";
import { normalizeDemoSelection } from "@/lib/demo/selection";
import { transitionDemo } from "@/lib/demo/transitions";
import { createDemoSnapshot } from "@/lib/demo/fixtures";
import { defaultDemoSelection } from "@/lib/demo/selection";

const selectionSchema = z.object({
  view: z.string().max(20), month: z.string().max(7), type: z.string().max(10),
  categoryId: z.string().max(80), subcategoryId: z.string().max(80),
  period: z.number(), balanceMonths: z.string().max(3), changeWindow: z.number(), changeMonth: z.string().max(7),
}).strict();

export async function updateDemo(snapshot: unknown, selection: unknown, command: unknown): Promise<
  { ok: true; data: DemoData } | { ok: false; error: string }
> {
  try {
    const nextSelection = normalizeDemoSelection(selectionSchema.parse(selection));
    const nextSnapshot = transitionDemo(snapshot, command);
    return { ok: true, data: calculateDemo(nextSnapshot, nextSelection) };
  } catch (error) {
    return { ok: false, error: error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid demo data." : error instanceof Error ? error.message : "Could not update the demo. Please try again." };
  }
}

export async function resetDemo() {
  return calculateDemo(createDemoSnapshot(), defaultDemoSelection);
}
