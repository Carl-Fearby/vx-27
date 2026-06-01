#!/usr/bin/env node
/**
 * Snapshot full git history into lib/gitCommitHistory.json for /version.
 * Runs on dev start and prebuild — do not edit the JSON by hand.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "gitCommitHistory.json");

function gitShortHead() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function readGitLog() {
  try {
    const raw = execSync('git log --format="%h%x1f%ad%x1f%s" --date=short', {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, date, subject] = line.split("\x1f");
        return { sha, date, subject };
      });
  } catch {
    return [];
  }
}

const commits = readGitLog();
const payload = {
  generatedAt: new Date().toISOString(),
  head: gitShortHead(),
  count: commits.length,
  commits,
};

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`version history: ${commits.length} commits → lib/gitCommitHistory.json`);
