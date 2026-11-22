import assert from "node:assert/strict";
import { register } from "node:module";
import test, { mock } from "node:test";

const users = new Map([
  ["user-a", { currency: "CHF", hasCompletedSetup: true, timeZone: "Europe/Zurich" }],
  ["user-b", { currency: "USD", hasCompletedSetup: false, timeZone: "America/Los_Angeles" }],
  ["legacy-user", { currency: "EUR", hasCompletedSetup: true, timeZone: null }],
]);

const findUnique = mock.fn(async ({ where, select }: {
  where: { id: string };
  select: Record<string, boolean>;
}) => {
  assert.deepEqual(select, { currency: true, hasCompletedSetup: true, timeZone: true });
  return users.get(where.id) ?? null;
});

let sessionUserId: string | null = null;

// The Node test worker substitutes these exports before importing the real loader and layouts.
export const db = { user: { findUnique } };
export const authOptions = {};
export async function getServerSession() {
  return sessionUserId === null ? null : { user: { id: sessionUserId } };
}
export function redirect(path: string): never {
  throw new Error(`Redirect to ${path}`);
}
export const AppSidebar = () => null;
export const PageContextBar = () => null;
export const WorkspaceShell = () => null;
export const SetupFrame = () => null;

const overrides = new Map([
  ["@/lib/db", import.meta.url],
  ["@/lib/auth/options", import.meta.url],
  ["next-auth", import.meta.url],
  ["next/navigation", import.meta.url],
  ["@/components/app-shell/app-sidebar", import.meta.url],
  ["@/components/app-shell/page-context-bar", import.meta.url],
  ["@/components/app-shell/workspace-shell", import.meta.url],
  ["@/components/setup/setup-frame", import.meta.url],
  ["server-only", "data:text/javascript,export%20%7B%7D"],
]);

const resolver = `
let overrides;
export function initialize(data) {
  overrides = data;
}
export function resolve(specifier, context, nextResolve) {
  const url = overrides.get(specifier);
  return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(resolver)}`, { data: overrides });

test("the loader returns each requested user's preferences, including a null time zone", async () => {
  const { loadAccountPreferences } = await import("./account-preferences");
  const userIds = ["user-a", "user-b", "legacy-user"];
  const results = await Promise.all(userIds.map(loadAccountPreferences));

  assert.deepEqual(results, userIds.map((userId) => ({ userId, ...users.get(userId) })));
  await assert.rejects(loadAccountPreferences("missing-user"), { message: "Unauthorized" });
});

test("the web wrapper reads the session user's preferences and rejects missing identities", async () => {
  const { getAuthenticatedUserPreferences } = await import("../auth/session");

  for (const userId of ["user-b", "user-a"]) {
    sessionUserId = userId;
    assert.deepEqual(await getAuthenticatedUserPreferences(), { userId, ...users.get(userId) });
  }

  sessionUserId = "missing-user";
  await assert.rejects(getAuthenticatedUserPreferences(), { message: "Unauthorized" });

  sessionUserId = null;
  const callsBefore = findUnique.mock.callCount();
  await assert.rejects(getAuthenticatedUserPreferences(), { message: "Unauthorized" });
  assert.equal(findUnique.mock.callCount(), callsBefore);
});

test("the real app and onboarding layouts preserve their setup decisions", async () => {
  const [{ default: AppLayout }, { default: OnboardingLayout }] = await Promise.all([
    import("../../app/(app)/layout"),
    import("../../app/(onboarding)/layout"),
  ]);
  const props = { children: null };

  sessionUserId = null;
  await assert.rejects(AppLayout(props), { message: "Redirect to /login" });

  sessionUserId = "user-a";
  assert.equal((await AppLayout(props)).type, WorkspaceShell);
  await assert.rejects(OnboardingLayout(props), { message: "Redirect to /dashboard" });

  for (const userId of ["user-b", "legacy-user"]) {
    sessionUserId = userId;
    await assert.rejects(AppLayout(props), { message: "Redirect to /setup" });
    assert.equal((await OnboardingLayout(props)).type, SetupFrame);
  }
});
