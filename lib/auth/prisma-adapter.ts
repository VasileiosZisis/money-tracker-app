import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";

import type { PrismaClient } from "@/generated/prisma/client";

// Keep the adapter local so NextAuth v4 does not depend on the v5 Auth.js Prisma adapter package.
type PrismaLike = PrismaClient | ReturnType<PrismaClient["$extends"]>;
type CreateUserInput = Parameters<NonNullable<Adapter["createUser"]>>[0];
type LinkAccountInput = Parameters<NonNullable<Adapter["linkAccount"]>>[0];
type UnlinkAccountInput = Parameters<NonNullable<Adapter["unlinkAccount"]>>[0];

export function PrismaAdapter(prisma: PrismaLike): Adapter {
  const client = prisma as PrismaClient;

  return {
    createUser: (data: CreateUserInput) =>
      client.user.create(withoutUndefined(data)) as Promise<AdapterUser>,
    getUser: (id) =>
      client.user.findUnique({ where: { id } }) as Promise<AdapterUser | null>,
    getUserByEmail: (email) =>
      client.user.findUnique({ where: { email } }) as Promise<AdapterUser | null>,
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await client.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });

      return (account?.user as AdapterUser | undefined) ?? null;
    },
    updateUser: ({ id, ...data }) =>
      client.user.update({
        where: { id },
        ...withoutUndefined(data),
      }) as Promise<AdapterUser>,
    deleteUser: (id) =>
      client.user.delete({ where: { id } }) as Promise<AdapterUser>,
    linkAccount: (account: LinkAccountInput) =>
      client.account.create({ data: account }) as Promise<AdapterAccount>,
    unlinkAccount: ({ provider, providerAccountId }: UnlinkAccountInput) =>
      client.account.delete({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
      }) as Promise<AdapterAccount>,
    createSession: (session) =>
      client.session.create({ data: session }) as Promise<AdapterSession>,
    async getSessionAndUser(sessionToken) {
      const sessionAndUser = await client.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (!sessionAndUser) {
        return null;
      }

      const { user, ...session } = sessionAndUser;
      return {
        session: session as AdapterSession,
        user: user as AdapterUser,
      };
    },
    updateSession: ({ sessionToken, ...data }) =>
      client.session.update({
        where: { sessionToken },
        ...withoutUndefined(data),
      }) as Promise<AdapterSession>,
    deleteSession: (sessionToken) =>
      client.session.delete({ where: { sessionToken } }) as Promise<AdapterSession>,
    createVerificationToken: (token) =>
      client.verificationToken.create({ data: token }) as Promise<VerificationToken>,
    async useVerificationToken({ identifier, token }) {
      try {
        return (await client.verificationToken.delete({
          where: {
            identifier_token: {
              identifier,
              token,
            },
          },
        })) as VerificationToken;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return null;
        }

        throw error;
      }
    },
  };
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  const data: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      data[key] = entry;
    }
  }

  return { data: data as T };
}
