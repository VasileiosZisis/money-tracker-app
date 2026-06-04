import { execFileSync } from "node:child_process";

const DEPLOY_MARKER = "[deploy]";

function readCommitMessage() {
  const envMessage =
    process.env.VERCEL_GIT_COMMIT_MESSAGE ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE;

  if (envMessage?.trim()) {
    return envMessage;
  }

  try {
    return execFileSync("git", ["log", "-1", "--pretty=%B"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

const commitMessage = readCommitMessage();

if (commitMessage.toLowerCase().includes(DEPLOY_MARKER)) {
  console.log(`Found ${DEPLOY_MARKER}; continuing Vercel build.`);
  process.exit(1);
}

console.log(`No ${DEPLOY_MARKER} marker found; skipping Vercel build.`);
process.exit(0);
