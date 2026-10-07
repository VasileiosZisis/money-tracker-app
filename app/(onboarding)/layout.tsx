import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupFrame } from "@/components/setup/setup-frame";
import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { privateRobots } from "@/lib/site/metadata";

export const metadata: Metadata = { robots: privateRobots };

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUserPreferences();

  if (user.hasCompletedSetup && user.timeZone) {
    redirect("/dashboard");
  }

  return <SetupFrame>{children}</SetupFrame>;
}
