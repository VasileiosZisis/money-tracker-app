import { randomBytes } from "node:crypto";
import { lstat, open, readFile, rename, unlink } from "node:fs/promises";
import { isDeepStrictEqual, parseEnv } from "node:util";

import { readConfig } from "./config.mjs";
import { EnrollmentError, subjectPattern } from "./enrollment.mjs";

const configFile = new URL(".env.local", import.meta.url);
const subjectKey = "GOOGLE_PROOF_ALLOWED_SUBJECTS";
const subjectAssignment = /^[\t ]*(?:export[\t ]+)?GOOGLE_PROOF_ALLOWED_SUBJECTS[\t ]*=[^\r\n]*/gm;
export const enrollmentSecretKey = "GOOGLE_PROOF_ENROLLMENT_CLIENT_SECRET";

function parseVerifierEnv(contents) {
  const env = parseEnv(contents);
  if (Object.hasOwn(env, enrollmentSecretKey)) {
    throw new EnrollmentError("Remove the enrollment secret from .env.local and supply it through the temporary environment variable.");
  }
  return env;
}

async function readEnvFile(target = configFile) {
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.nlink !== 1 || info.size > 64 * 1024) throw new EnrollmentError();
    return await readFile(target, "utf8");
  } catch {
    throw new EnrollmentError("Prepare a regular verifier .env.local file using the README.");
  }
}

export async function readEnrollmentAudience() {
  const env = parseVerifierEnv(await readEnvFile());
  try {
    const config = readConfig({ ...env, [subjectKey]: env[subjectKey] || "pending" });
    if (!config.allowedPresenters.has(config.audience)) throw new EnrollmentError();
    return config.audience;
  } catch {
    throw new EnrollmentError("Set the verifier's development Web client ID and allowlisted presenters in .env.local.");
  }
}

export function addVerifiedSubject(contents, audience, subject) {
  const env = parseVerifierEnv(contents);
  if (env.GOOGLE_PROOF_AUDIENCE?.trim() !== audience) {
    throw new EnrollmentError("The verifier audience changed. Restart enrollment.");
  }
  const existing = env[subjectKey]?.trim()
    ? env[subjectKey].split(",").map((value) => value.trim())
    : [];
  const assignments = [...contents.matchAll(subjectAssignment)];
  if (
    typeof subject !== "string" ||
    !subjectPattern.test(subject) ||
    !existing.every((value) => subjectPattern.test(value)) ||
    assignments.length > 1
  ) {
    throw new EnrollmentError("The verifier subject allowlist needs manual review. No subject was saved.");
  }
  if (existing.includes(subject)) return contents;

  const entry = [...existing, subject].join(",");
  const assignment = `${subjectKey}=${entry}`;
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const updated = assignments.length
    ? contents.replace(subjectAssignment, assignment)
    : contents + (contents.endsWith("\n") ? "" : newline) + assignment + newline;
  if (!isDeepStrictEqual({ ...parseEnv(updated) }, { ...env, [subjectKey]: entry })) {
    throw new EnrollmentError("The allowlist assignment could not be updated safely. No subject was saved.");
  }
  return updated;
}

export async function saveVerifiedSubject(audience, subject, signal, target = configFile) {
  signal.throwIfAborted();
  const lockPath = new URL(".env.local.enrollment-lock", target);
  const lock = await open(lockPath, "wx", 0o600).catch((error) => {
    if (error.code === "EEXIST") throw new EnrollmentError("An enrollment save is already locked. Check the verifier README.");
    throw error;
  });

  try {
    const contents = await readEnvFile(target);
    const updated = addVerifiedSubject(contents, audience, subject);
    if (contents === updated) return false;

    const tempFile = new URL(".env.local.enrollment-" + randomBytes(16).toString("hex"), target);
    const file = await open(tempFile, "wx", 0o600);
    try {
      try {
        await file.writeFile(updated, "utf8");
      } finally {
        await file.close();
      }
      if (await readEnvFile(target) !== contents) {
        throw new EnrollmentError("The verifier .env.local changed. Restart enrollment.");
      }
      signal.throwIfAborted();
      await rename(tempFile, target);
    } finally {
      await unlink(tempFile).catch(() => {});
    }
    return true;
  } finally {
    await lock.close().finally(() => unlink(lockPath).catch(() => {}));
  }
}
