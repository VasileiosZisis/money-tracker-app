import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetupFrame } from "@/components/setup/setup-frame";
import { SetupPreview } from "@/components/setup/setup-preview";
import { getSupportedTimeZones } from "@/lib/dates/time-zone";
import { isLocalPreviewEnabled } from "@/lib/dev/local-preview";
import { privateRobots } from "@/lib/site/metadata";

export const metadata: Metadata = { title: "Setup preview", robots: privateRobots };

export default function SetupPreviewPage() {
  if (!isLocalPreviewEnabled(process.env.NODE_ENV, process.env.VERCEL)) notFound();
  return <SetupFrame><SetupPreview timeZones={getSupportedTimeZones()} /></SetupFrame>;
}
