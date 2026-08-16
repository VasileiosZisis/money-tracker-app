import { ImportWorkspace } from "./import-workspace";
import { redirect } from "next/navigation";

import { getAuthenticatedUserPreferences } from "@/lib/auth/session";
import { getCurrentMonthInTimeZone } from "@/lib/dates/time-zone";

export default async function ImportPage() {
  const user = await getAuthenticatedUserPreferences();

  if (!user.timeZone) {
    redirect("/setup");
  }

  return (
    <ImportWorkspace currentMonth={getCurrentMonthInTimeZone(user.timeZone)} />
  );
}
