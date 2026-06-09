#!/usr/bin/env node
/**
 * Build a static export and upload to Fasthosts FTP (HTDOCS).
 *
 * Setup:
 *   cp scripts/fasthosts.deploy.env.example scripts/fasthosts.deploy.env
 *   # add FASTHOSTS_FTP_PASSWORD
 *   npm install
 *
 * Usage:
 *   npm run deploy:fasthosts
 *   npm run deploy:fasthosts -- --build-only
 *   npm run deploy:fasthosts -- --clean     # wipe remote HTDOCS before upload
 *   npm run deploy:fasthosts -- --verbose
 *   npm run deploy:fasthosts -- --probe     # list FTP folders, no upload
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "basic-ftp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
/** Next distDir is node_modules/.cache/next — static export lands there too. */
const OUT_DIR =
  process.env.FASTHOSTS_EXPORT_DIR ||
  path.join(ROOT, "node_modules", ".cache", "next");
const ENV_FILE = path.join(__dirname, "fasthosts.deploy.env");

const args = new Set(process.argv.slice(2));
const buildOnly = args.has("--build-only");
const cleanRemote = args.has("--clean");
const probeOnly = args.has("--probe");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

/** Refuse deploy if credentials file is tracked or looks like it was staged. */
function assertDeployEnvSafe() {
  const tracked = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", path.relative(ROOT, ENV_FILE)],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (tracked.status === 0) {
    console.error(
      "Refusing deploy: scripts/fasthosts.deploy.env is tracked by git. " +
        "Run `git rm --cached scripts/fasthosts.deploy.env` and keep credentials local only."
    );
    process.exit(1);
  }

  const staged = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--", path.relative(ROOT, ENV_FILE)],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (staged.stdout?.trim()) {
    console.error(
      "Refusing deploy: scripts/fasthosts.deploy.env is staged for commit. Unstage it first."
    );
    process.exit(1);
  }

  if (!existsSync(ENV_FILE)) return;

  try {
    const mode = statSync(ENV_FILE).mode & 0o777;
    if (mode & 0o077) {
      console.warn(
        `Warning: ${path.relative(ROOT, ENV_FILE)} is world/group readable (mode ${mode.toString(8)}). ` +
          "Consider chmod 600."
      );
    }
  } catch {
    // ignore
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set it in scripts/fasthosts.deploy.env or the environment.`);
    process.exit(1);
  }
  return value;
}

function runBuild() {
  console.log("Building static export (STATIC_EXPORT=1)…");
  const result = spawnSync("npm", ["run", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1" },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  if (!existsSync(path.join(OUT_DIR, "index.html"))) {
    console.error(`Build finished but ${OUT_DIR}/index.html was not found.`);
    process.exit(1);
  }
}

function findListingName(listing, ...candidates) {
  const names = listing.map((entry) => entry.name);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const exact = names.find((name) => name === candidate);
    if (exact) return exact;
    const ci = names.find(
      (name) => name.toLowerCase() === candidate.toLowerCase()
    );
    if (ci) return ci;
  }
  return null;
}

/**
 * Fasthosts: login is often already chrooted to /htdocs. Account root may list
 * HTDOCS + LOGFILES — cd into HTDOCS only from there. Never ensureDir/mkdir.
 */
async function resolveRemoteDeployDir(client, configuredDir) {
  const startPwd = await client.pwd();
  const rootListing = await client.list();
  const rootNames = rootListing.map((entry) => entry.name);

  console.log(`FTP root: ${startPwd}`);
  console.log(`FTP folders: ${rootNames.join(", ") || "(empty)"}`);

  const configured = (configuredDir ?? ".").replace(/^\/+|\/+$/g, "");
  const pwdLower = startPwd.toLowerCase().replace(/\/+$/, "");

  // Already inside the web root (common Fasthosts chroot).
  if (pwdLower.endsWith("/htdocs") || pwdLower === "htdocs") {
    console.log(`Deploy target: ${startPwd} (FTP web root)`);
    return startPwd;
  }

  // Account home: HTDOCS + LOGFILES siblings — enter HTDOCS/htdocs.
  const hasLogfiles = rootNames.some((name) => name.toUpperCase() === "LOGFILES");
  const webFolder = findListingName(
    rootListing,
    configured === "." ? null : configured,
    "HTDOCS",
    "htdocs"
  );
  if (hasLogfiles && webFolder) {
    await client.cd(webFolder);
    const pwd = await client.pwd();
    console.log(`Deploy target: ${pwd} (${webFolder}/)`);
    return pwd;
  }

  if (configured && configured !== ".") {
    const sub = findListingName(rootListing, configured);
    if (sub) {
      await client.cd(sub);
      const pwd = await client.pwd();
      console.log(`Deploy target: ${pwd} (${sub}/)`);
      return pwd;
    }
  }

  console.log(`Deploy target: ${startPwd} (using FTP login directory)`);
  return startPwd;
}

function assertNotNestedHtdocs(pwd) {
  const normal = pwd.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
  if (normal.endsWith("/htdocs/htdocs") || normal === "htdocs/htdocs") {
    throw new Error(
      "Refusing to deploy to /htdocs/htdocs — files must go in /htdocs only. " +
        "Set FASTHOSTS_FTP_REMOTE_DIR=. in scripts/fasthosts.deploy.env"
    );
  }
}

async function probeRemote() {
  const host = process.env.FASTHOSTS_FTP_HOST || "ftp.fasthosts.co.uk";
  const user = requireEnv("FASTHOSTS_FTP_USER");
  const password = requireEnv("FASTHOSTS_FTP_PASSWORD");
  const configuredDir = process.env.FASTHOSTS_FTP_REMOTE_DIR ?? ".";

  const client = new Client(60_000);
  client.ftp.verbose = args.has("--verbose");

  try {
    await client.access({
      host,
      user,
      password,
      secure: process.env.FASTHOSTS_FTP_SECURE === "1",
    });
    await resolveRemoteDeployDir(client, configuredDir);
    assertNotNestedHtdocs(await client.pwd());
    const listing = await client.list();
    console.log(
      "Contents:",
      listing.map((entry) => `${entry.name}${entry.isDirectory ? "/" : ""}`).join(", ") ||
        "(empty)"
    );
  } finally {
    client.close();
  }
}

async function uploadOutDirOnce() {
  const host = process.env.FASTHOSTS_FTP_HOST || "ftp.fasthosts.co.uk";
  const user = requireEnv("FASTHOSTS_FTP_USER");
  const password = requireEnv("FASTHOSTS_FTP_PASSWORD");
  const configuredDir = process.env.FASTHOSTS_FTP_REMOTE_DIR ?? ".";

  const client = new Client(60_000);
  client.ftp.verbose = args.has("--verbose");

  try {
    await client.access({
      host,
      user,
      password,
      secure: process.env.FASTHOSTS_FTP_SECURE === "1",
    });
    const target = await resolveRemoteDeployDir(client, configuredDir);
    assertNotNestedHtdocs(await client.pwd());
    if (cleanRemote) {
      console.log(`Clearing ${target} …`);
      await client.clearWorkingDir();
    }
    await client.uploadFromDir(OUT_DIR);
    console.log("Deploy complete.");
  } finally {
    client.close();
  }
}

function isRetryableFtpUploadError(err) {
  const code = err?.code;
  if (code === 425 || code === 421 || code === 426) return true;
  if (code === "ERR_STREAM_UNABLE_TO_PIPE") return true;
  if (typeof code === "number" && code >= 421 && code <= 426) return true;
  return false;
}

async function uploadOutDir() {
  const maxAttempts = Number(process.env.FASTHOSTS_FTP_UPLOAD_RETRIES ?? 4);
  console.log(`Uploading ${OUT_DIR} …`);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadOutDirOnce();
      return;
    } catch (err) {
      if (!isRetryableFtpUploadError(err) || attempt >= maxAttempts) throw err;
      const waitMs = 4000 * attempt;
      console.warn(
        `FTP upload failed (${err.code ?? err.message}) — retry ${attempt}/${maxAttempts - 1} in ${waitMs / 1000}s…`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

assertDeployEnvSafe();
loadEnvFile(ENV_FILE);

if (probeOnly) {
  if (!existsSync(ENV_FILE) && !process.env.FASTHOSTS_FTP_PASSWORD) {
    console.error(
      "Create scripts/fasthosts.deploy.env from scripts/fasthosts.deploy.env.example first."
    );
    process.exit(1);
  }
  await probeRemote();
  process.exit(0);
}

if (!buildOnly && !existsSync(ENV_FILE) && !process.env.FASTHOSTS_FTP_PASSWORD) {
  console.error(
    "Create scripts/fasthosts.deploy.env from scripts/fasthosts.deploy.env.example first."
  );
  process.exit(1);
}

if (!probeOnly) {
  runBuild();
}

if (!buildOnly) {
  await uploadOutDir();
}
