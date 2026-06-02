#!/usr/bin/env node
/**
 * Prepare a semver release: bump package.json and prepend lib/versionHistory.js.
 *
 * Usage:
 *   npm run release:patch
 *   npm run release:minor
 *   npm run release:major
 *   npm run release -- --title "Short title" --change "Bullet one" --change "Bullet two"
 *   npm run release -- --dry-run
 *   npm run release:sync-commit          # after git commit — set newest entry commit to HEAD
 *
 * Workflow:
 *   1. npm run release:patch             # edit title + bullets when prompted
 *   2. git add package.json package-lock.json lib/versionHistory.js && git commit …
 *   3. npm run release:sync-commit       # stamp the release commit hash
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = path.join(ROOT, "package.json");
const LOCK_PATH = path.join(ROOT, "package-lock.json");
const HISTORY_PATH = path.join(ROOT, "lib", "versionHistory.js");
const HISTORY_MARKER = "export const VERSION_HISTORY = [";

function usage() {
  console.log(`Usage: node scripts/release.mjs [--patch|--minor|--major] [options]

Options:
  --patch | --minor | --major   Bump level (default: patch)
  --title "Release title"       Short title for versionHistory + commit subject
  --change "Bullet point"       Repeat for each release note line
  --dry-run                     Print planned changes without writing files
  --yes                         Skip confirmation prompt
  --sync-commit                 Update newest versionHistory entry commit to HEAD
  -h, --help                    Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    bump: "patch",
    title: "",
    changes: [],
    dryRun: false,
    yes: false,
    syncCommit: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--patch") opts.bump = "patch";
    else if (arg === "--minor") opts.bump = "minor";
    else if (arg === "--major") opts.bump = "major";
    else if (arg === "--title") opts.title = argv[++i] ?? "";
    else if (arg === "--change") opts.changes.push(argv[++i] ?? "");
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--yes") opts.yes = true;
    else if (arg === "--sync-commit") opts.syncCommit = true;
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(1);
    }
  }

  return opts;
}

function gitShortHead() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "dev";
  }
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bumpVersion(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver in package.json: ${version}`);
  }
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function jsString(value) {
  return JSON.stringify(String(value));
}

function formatReleaseEntry({ version, date, commit, title, changes }) {
  const changeLines = changes.map((line) => `      ${jsString(line)},`).join("\n");
  return `  {
    version: ${jsString(version)},
    date: ${jsString(date)},
    commit: ${jsString(commit)},
    title: ${jsString(title)},
    changes: [
${changeLines}
    ],
  },`;
}

function readVersionHistorySource() {
  return readFileSync(HISTORY_PATH, "utf8");
}

function prependReleaseEntry(source, entryBlock) {
  const markerIndex = source.indexOf(HISTORY_MARKER);
  if (markerIndex === -1) {
    throw new Error(`Could not find ${HISTORY_MARKER} in lib/versionHistory.js`);
  }
  const insertAt = markerIndex + HISTORY_MARKER.length;
  return `${source.slice(0, insertAt)}\n${entryBlock}\n${source.slice(insertAt)}`;
}

function readTopReleaseVersion(source) {
  const match = /^\s*{\s*\n\s*version:\s*"([^"]+)"/m.exec(
    source.slice(source.indexOf(HISTORY_MARKER))
  );
  return match?.[1] ?? null;
}

function replaceTopReleaseCommit(source, commit) {
  const start = source.indexOf(HISTORY_MARKER);
  if (start === -1) {
    throw new Error(`Could not find ${HISTORY_MARKER} in lib/versionHistory.js`);
  }
  const block = source.slice(start);
  const updated = block.replace(
    /(^\s*{\s*\n\s*version:\s*"[^"]+",\s*\n\s*date:\s*"[^"]+",\s*\n\s*commit:\s*")([^"]+)(")/m,
    `$1${commit}$3`
  );
  if (updated === block) {
    throw new Error("Could not update commit on newest versionHistory entry");
  }
  return source.slice(0, start) + updated;
}

function readPackageJson() {
  return JSON.parse(readFileSync(PKG_PATH, "utf8"));
}

function writePackageJson(pkg) {
  writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
}

function writePackageLockVersion(version) {
  try {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
    lock.version = version;
    if (lock.packages?.[""]) {
      lock.packages[""].version = version;
    }
    writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  } catch {
    // package-lock optional in some setups
  }
}

async function promptLine(rl, question, { required = false, defaultValue = "" } = {}) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  while (true) {
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    const value = answer || defaultValue;
    if (!required || value) return value;
    console.log("  (required)");
  }
}

async function promptChanges(rl) {
  console.log("Enter release bullets (blank line to finish):");
  const changes = [];
  while (true) {
    const line = (await rl.question(`  ${changes.length + 1}. `)).trim();
    if (!line) break;
    changes.push(line);
  }
  if (changes.length === 0) {
    throw new Error("At least one --change bullet is required");
  }
  return changes;
}

function buildCommitMessage(version, title, changes) {
  const subject = `Release v${version}: ${title.replace(/\.$/, "")}.`;
  if (changes.length === 0) return subject;
  const body = changes.map((line) => `- ${line}`).join("\n");
  return `${subject}\n\n${body}`;
}

function printNextSteps(version, commitMessage) {
  console.log("\nSuggested commit:");
  console.log("---");
  console.log("git add package.json package-lock.json lib/versionHistory.js");
  console.log(
    `git commit -m "$(cat <<'EOF'\n${commitMessage}\nEOF\n)"`
  );
  console.log("---");
  console.log(`Then stamp the release commit hash:\n  npm run release:sync-commit`);
  console.log(`\nOptional: npm run version:history && npm run deploy:fasthosts`);
}

function syncCommit(opts) {
  const source = readVersionHistorySource();
  const topVersion = readTopReleaseVersion(source);
  const head = gitShortHead();
  const next = replaceTopReleaseCommit(source, head);

  if (opts.dryRun) {
    console.log(`Would set v${topVersion} commit → ${head}`);
    return;
  }

  writeFileSync(HISTORY_PATH, next);
  console.log(`Updated lib/versionHistory.js: v${topVersion} commit → ${head}`);
  console.log("\nCommit the hash fix:");
  console.log(`git add lib/versionHistory.js`);
  console.log(`git commit -m "Fix v${topVersion} release commit hash in version history."`);
}

async function runRelease(opts) {
  const pkg = readPackageJson();
  const currentVersion = pkg.version;
  const nextVersion = bumpVersion(currentVersion, opts.bump);
  const date = todayIsoDate();
  const pendingCommit = "pending";

  let title = opts.title.trim();
  let changes = opts.changes.map((line) => line.trim()).filter(Boolean);

  const rl = readline.createInterface({ input, output });
  try {
    if (!title) {
      title = await promptLine(rl, "Release title", { required: true });
    }
    if (changes.length === 0) {
      changes = await promptChanges(rl);
    }
  } finally {
    rl.close();
  }

  const entryBlock = formatReleaseEntry({
    version: nextVersion,
    date,
    commit: pendingCommit,
    title,
    changes,
  });

  const historySource = readVersionHistorySource();
  const nextHistory = prependReleaseEntry(historySource, entryBlock);
  const commitMessage = buildCommitMessage(nextVersion, title, changes);

  console.log("\nRelease plan");
  console.log(`  Version:  v${currentVersion} → v${nextVersion} (${opts.bump})`);
  console.log(`  Date:     ${date}`);
  console.log(`  Title:    ${title}`);
  console.log(`  Bullets:  ${changes.length}`);
  for (const line of changes) console.log(`    - ${line}`);

  if (opts.dryRun) {
    console.log("\n(versionHistory entry preview)\n");
    console.log(entryBlock);
    printNextSteps(nextVersion, commitMessage);
    return;
  }

  if (!opts.yes) {
    const rlConfirm = readline.createInterface({ input, output });
    let answer = "";
    try {
      answer = (await rlConfirm.question("\nWrite these files? [y/N] ")).trim().toLowerCase();
    } finally {
      rlConfirm.close();
    }
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  pkg.version = nextVersion;
  writePackageJson(pkg);
  writePackageLockVersion(nextVersion);
  writeFileSync(HISTORY_PATH, nextHistory);

  console.log(`\nWrote v${nextVersion} to package.json and lib/versionHistory.js`);
  printNextSteps(nextVersion, commitMessage);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  usage();
  process.exit(0);
}

if (opts.syncCommit) {
  syncCommit(opts);
} else {
  runRelease(opts).catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
