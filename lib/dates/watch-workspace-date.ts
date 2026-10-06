import { getAccountDateContext, type AccountDateContext } from "./time-zone";

/** The demo opts out; real accounts continue refreshing at account-local midnight. */
export function watchWorkspaceDate({ fixedCalendar, initialDateContext, timeZone, onDateChange, scheduler, readDateContext = getAccountDateContext }: {
  fixedCalendar: boolean; initialDateContext: AccountDateContext; timeZone: string;
  onDateChange: (context: AccountDateContext) => void;
  scheduler: { setInterval: (callback: () => void, delay: number) => number; clearInterval: (id: number) => void };
  readDateContext?: (timeZone: string) => AccountDateContext;
}) {
  if (fixedCalendar) return () => {};
  let previousLocalDate = initialDateContext.localDate;
  function update() {
    const next = readDateContext(timeZone);
    if (next.localDate !== previousLocalDate) {
      previousLocalDate = next.localDate;
      onDateChange(next);
    }
  }
  update();
  const interval = scheduler.setInterval(update, 60 * 1000);
  return () => scheduler.clearInterval(interval);
}
