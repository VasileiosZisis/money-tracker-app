import { persistPreviewData } from "./preview-seed-persistence";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { assertPreviewTarget, buildPreviewData, requireSeedAccount, SeedError } from "./preview-seed";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@") || process.argv.length !== 3) throw new SeedError("Usage: npx tsx prisma/seed.ts <existing-preview-account-email>");
  loadEnv({ path: ".env.local" });
  const connectionString = process.env.DATABASE_URL;
  assertPreviewTarget(connectionString);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
  try {
    const summary = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { email } });
      requireSeedAccount(user);
      const data = buildPreviewData(user, new Date());
      const result = await persistPreviewData(tx, data, user.id);
      return { database: "previewdb", currency: user.currency, from: data.months[0], through: data.months.at(-1), records: result };
    }, { isolationLevel: "Serializable", timeout: 60000, maxWait: 10000 });
    console.log(JSON.stringify(summary, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch(error => {
  // Only our controlled errors are safe to display; driver errors may contain credentials.
  console.error(error instanceof SeedError ? error.message : "Preview seed failed; no changes committed. Check target, setup and sample conflicts.");
  process.exitCode = 1;
});
