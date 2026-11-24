import { execFile } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { OAuth2Client } from "google-auth-library";

import { enrollmentSecretKey, readEnrollmentAudience, saveVerifiedSubject } from "./enrollment-config.mjs";
import {
  callbackUri,
  confirmEnrollment,
  EnrollmentError,
  prepareAuthorization,
  receiveEnrollmentCode,
  verifyEnrollmentSubject,
} from "./enrollment.mjs";

const launch = promisify(execFile);

async function openBrowser(url) {
  const command = "Start-Process -ErrorAction Stop -FilePath '" + url.replaceAll("'", "''") + "'";
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32",
    "WindowsPowerShell", "v1.0", "powershell.exe");
  await launch(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    windowsHide: true,
    timeout: 10_000,
  });
}

async function enroll() {
  const clientSecret = process.env[enrollmentSecretKey]?.trim();
  delete process.env[enrollmentSecretKey];
  if (!clientSecret) throw new EnrollmentError("Set GOOGLE_PROOF_ENROLLMENT_CLIENT_SECRET temporarily.");
  if (process.platform !== "win32" || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new EnrollmentError("Run enrollment in an interactive Windows PowerShell terminal.");
  }
  if (process.env.NODE_DEBUG || process.env.NODE_DEBUG_NATIVE) {
    throw new EnrollmentError("Turn off Node debug logging before running enrollment.");
  }

  const audience = await readEnrollmentAudience();
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const controller = new AbortController();
  const { signal } = controller;
  const cancel = () => controller.abort(new EnrollmentError("Enrollment canceled."));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  terminal.on("SIGINT", cancel);
  terminal.once("close", cancel);
  try {
    const expectedEmail = (await terminal.question("Enter the dedicated Google test account email: ", { signal })).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedEmail)) {
      throw new EnrollmentError("Enter a valid test account email.");
    }

    const google = new OAuth2Client({
      clientId: audience,
      clientSecret,
      redirectUri: callbackUri,
      // The default response interceptor can log token responses in debug mode.
      useAuthRequestParameters: false,
      transporterOptions: { timeout: 10_000, retryConfig: { retry: 0 }, redirect: "error", signal },
    });
    const authorization = await prepareAuthorization(google);
    const code = await receiveEnrollmentCode(authorization, openBrowser, signal);
    const subject = await verifyEnrollmentSubject(google, {
      code,
      codeVerifier: authorization.codeVerifier,
      nonce: authorization.nonce,
      audience,
      expectedEmail,
    });
    signal.throwIfAborted();

    const changed = await confirmEnrollment(
      () => terminal.question(
        "Google verified the email you entered. Type ENROLL to confirm this is your dedicated test account: ",
        { signal },
      ),
      () => saveVerifiedSubject(audience, subject, signal),
      signal,
    );
    process.stdout.write(changed
      ? "Saved the verified subject to the verifier's .env.local allowlist.\n"
      : "The verified subject is already on the verifier's .env.local allowlist.\n");
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    terminal.close();
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

try {
  await enroll();
} catch (error) {
  const message = error instanceof EnrollmentError ? error.message :
    "Test enrollment failed. Check the development OAuth settings and verifier .env.local.";
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}
