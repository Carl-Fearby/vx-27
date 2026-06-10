#!/usr/bin/env node
/**
 * Snapshot full git history + code size into lib/version/gitCommitHistory.json for /version.
 * Runs on dev start and prebuild — do not edit the JSON by hand.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "version", "gitCommitHistory.json");
const COMMIT_RECORD_SEP = "\x1e";
const COMMIT_FIELD_SEP = "\x1f";
const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
]);
const EXCLUDED_PREFIXES = [
  ".git/",
  ".next/",
  ".wip-",
  "node_modules/",
  "out/",
  "public/",
];
const EXCLUDED_FILES = new Set([
  "lib/version/gitCommitHistory.json",
  "package-lock.json",
]);

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
    const raw = execSync(
      'git log --date=short --format="format:%x1e%h%x1f%ad%x1f%s" --numstat',
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 50 * 1024 * 1024,
      }
    );
    return raw
      .split(COMMIT_RECORD_SEP)
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const lines = record.split("\n").filter(Boolean);
        const [sha, date, subject] = lines.shift().split(COMMIT_FIELD_SEP);
        const stats = lines.reduce(
          (acc, line) => {
            const [insertions, deletions] = line.split("\t");
            if (!insertions || !deletions) return acc;
            acc.filesChanged += 1;
            if (insertions === "-" || deletions === "-") {
              acc.binaryFiles += 1;
              return acc;
            }
            acc.insertions += Number(insertions) || 0;
            acc.deletions += Number(deletions) || 0;
            return acc;
          },
          { filesChanged: 0, insertions: 0, deletions: 0, binaryFiles: 0 }
        );
        return { sha, date, subject, stats };
      });
  } catch {
    return [];
  }
}

function readProjectFiles() {
  try {
    const raw = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return [...new Set(raw.trim().split("\n").filter(Boolean))]
      .map((file) => file.replace(/\\/g, "/"))
      .filter((file) => {
        if (EXCLUDED_FILES.has(file)) return false;
        if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) {
          return false;
        }
        return SOURCE_EXTENSIONS.has(path.extname(file));
      });
  } catch {
    return [];
  }
}

function countLines(text) {
  if (!text) return { lines: 0, nonBlankLines: 0 };
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return {
    lines: lines.length,
    nonBlankLines: lines.filter((line) => line.trim()).length,
  };
}

function readCodebaseStats() {
  const files = readProjectFiles();
  const totals = {
    files: 0,
    lines: 0,
    nonBlankLines: 0,
  };
  for (const file of files) {
    const abs = path.join(ROOT, file);
    if (!existsSync(abs)) continue;
    try {
      const stats = countLines(readFileSync(abs, "utf8"));
      totals.files += 1;
      totals.lines += stats.lines;
      totals.nonBlankLines += stats.nonBlankLines;
    } catch {
      // Ignore files that disappear or cannot be decoded as UTF-8.
    }
  }
  return totals;
}

function sumCommitStats(commits) {
  return commits.reduce(
    (acc, commit) => {
      acc.filesChanged += commit.stats?.filesChanged ?? 0;
      acc.insertions += commit.stats?.insertions ?? 0;
      acc.deletions += commit.stats?.deletions ?? 0;
      acc.binaryFiles += commit.stats?.binaryFiles ?? 0;
      return acc;
    },
    { filesChanged: 0, insertions: 0, deletions: 0, binaryFiles: 0 }
  );
}

const commits = readGitLog();
const codebase = readCodebaseStats();
const payload = {
  generatedAt: new Date().toISOString(),
  head: gitShortHead(),
  count: commits.length,
  codebase,
  historyStats: sumCommitStats(commits),
  commits,
};

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `version history: ${commits.length} commits, ${codebase.lines} source lines → lib/version/gitCommitHistory.json`
);
