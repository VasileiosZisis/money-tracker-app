import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const exportedDatabaseUrl = process.env.DATABASE_URL;

// Exported targets win; local values fill gaps before the shared defaults.
loadEnv({ path: path.resolve(".env.local") });
loadEnv({ path: path.resolve(".env") });

let datasourceUrl: string;

if (process.env.APP_ENV === "test") {
  const testEnv = loadEnv({
    path: path.resolve(".env.test.local"),
    override: true,
  });
  const testDatabaseUrl = testEnv.parsed?.DATABASE_URL || exportedDatabaseUrl;

  if (!testDatabaseUrl) {
    throw new Error(
      "APP_ENV=test requires DATABASE_URL in .env.test.local or the exported environment.",
    );
  }

  datasourceUrl = testDatabaseUrl;
} else {
  datasourceUrl = process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
