import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const developmentKeystore = "mobile/@goneaway__cashcontour-dev.jks";
const requiredFiles = [
  "mobile/app.config.js",
  "mobile/app.json",
  "mobile/assets/icon.png",
  "mobile/eas.json",
  "mobile/package-lock.json",
  "mobile/package.json",
  "mobile/plugins/without-network-inspector.js",
  "mobile/src/app/_layout.tsx",
  "mobile/src/app/index.tsx",
  "mobile/src/auth/google-proof.ts",
  "mobile/src/auth/google-sign-in.ts",
  "mobile/src/components/google-sign-in-proof.tsx",
  "mobile/src/theme/colors.ts",
  "mobile/tsconfig.json",
];
const allowedFiles = new Set([
  ...requiredFiles,
  "mobile/.gitignore",
  "mobile/eslint.config.js",
  "mobile/LICENSE",
  "mobile/README.md",
  "mobile/tests/google-proof-config.test.cjs",
  "mobile/tests/google-proof.test.cjs",
]);
const allowedDirectories = new Set();
for (const file of allowedFiles) {
  for (let directory = path.posix.dirname(file); directory !== "."; directory = path.posix.dirname(directory)) {
    allowedDirectories.add(directory);
  }
}

const findings = new Set();
const inspectedFiles = new Set();
const sensitiveVariable = /SECRET|PASSWORD|(?:^|_)TOKEN(?:_|$)|PRIVATE_KEY|DATABASE_URL|SUBJECT|ALLOWED_PRESENTERS|VERIFIER_ORIGIN|(?:GOOGLE.*CLIENT_ID|GOOGLE_PROOF_AUDIENCE)/;
const sensitiveContent = [
  /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY|CERTIFICATE|PKCS12)-----/,
  /\bGOCSPX-[A-Za-z0-9_-]{12,}\b/,
  /"(?:client_secret|private_key|keystorePassword|keyPassword)"\s*:\s*"[^"\r\n]+"/i,
  /\bpostgres(?:ql)?:\/\/[^/\s:]+:[^/\s@]+@/i,
];

async function readOptional(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function readPrivateValues() {
  const values = new Set();
  for (const directory of ["", "mobile", "tools/google-proof-verifier"]) {
    const source = path.join(workspace, directory);
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (!/^\.env(?:$|\.)/i.test(entry.name) || /\.(?:example|sample|template)$/i.test(entry.name)) {
        continue;
      }
      if (!entry.isFile()) throw new Error("Cannot inspect private configuration file.");
      const env = parseEnv(await readFile(path.join(source, entry.name), "utf8"));
      for (const [key, value] of Object.entries(env)) {
        if (!sensitiveVariable.test(key)) continue;
        const candidates = /SUBJECT|ALLOWED_PRESENTERS/.test(key) ? value.split(",") : [value];
        for (const candidate of candidates) {
          if (candidate.trim().length >= 12) values.add(candidate.trim());
        }
      }
    }
  }
  return values;
}

async function inspectDirectory(directory, prefix, backup, privateValues) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = prefix ? prefix + "/" + entry.name : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && allowedDirectories.has(file)) {
      await inspectDirectory(absolute, file, backup, privateValues);
      continue;
    }
    if (!entry.isFile() || !allowedFiles.has(file)) {
      findings.add("Unexpected archive path or filesystem entry.");
      continue;
    }

    inspectedFiles.add(file);
    const source = await readFile(path.join(workspace, file));
    if ((await lstat(absolute)).size !== source.length) {
      findings.add("An approved archive file differs from the working copy.");
      continue;
    }
    const bytes = await readFile(absolute);
    const header = bytes.subarray(0, 4).toString("hex");
    if (header === "feedfeed" || header === "cececece" || backup?.equals(bytes)) {
      findings.add("Android signing material detected in archive contents.");
    }
    const content = bytes.toString("utf8");
    if (sensitiveContent.some((pattern) => pattern.test(content)) ||
        [...privateValues].some((value) => content.includes(value))) {
      findings.add("Private configuration or credential data detected in archive contents.");
    }
    if (!bytes.equals(source)) {
      findings.add("An approved archive file differs from the working copy.");
    }
  }
}

try {
  const input = process.argv[2];
  if (process.argv.length !== 3 || !input || !(await lstat(input)).isDirectory()) {
    throw new Error("Pass the extracted archive directory.");
  }
  const archive = await realpath(input);
  const relative = path.relative(await realpath(workspace), archive);
  if (!relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep))) {
    throw new Error("Archive must be outside the Git repository.");
  }
  const backup = await readOptional(path.join(workspace, developmentKeystore));
  await inspectDirectory(archive, "", backup, await readPrivateValues());
  for (const file of requiredFiles) {
    if (!inspectedFiles.has(file)) findings.add("Missing required file: " + file);
  }
  if (findings.size) {
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
  } else {
    console.log("EAS archive check passed. Approved files: " + inspectedFiles.size + ".");
  }
} catch {
  console.error("EAS archive check failed. Use Node 22.13 or newer and a readable archive directory outside the repository.");
  process.exitCode = 1;
}
