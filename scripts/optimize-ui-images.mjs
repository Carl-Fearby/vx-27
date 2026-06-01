#!/usr/bin/env node
/**
 * Lossless WebP for UI PNGs — only replaces when smaller than the PNG (no quality loss).
 *
 *   node scripts/optimize-ui-images.mjs
 *
 * PNGs that do not shrink (e.g. logo) are left as-is. Converted sources move to
 * public/ui/_source/ (gitignored).
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const UI = path.join(REPO, "public/ui");
const SOURCE = path.join(UI, "_source");

/** Always keep PNG — lossless WebP is larger for these. */
const KEEP_PNG = new Set(["logo.png", "endcap.png"]);

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const CWEBP = which("cwebp");
if (!CWEBP) {
  console.error("cwebp not found (brew install webp)");
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** @param {string} dir @returns {string[]} */
function listPngs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === "_source") continue;
      out.push(...listPngs(full));
      continue;
    }
    if (name.toLowerCase().endsWith(".png")) out.push(full);
  }
  return out;
}

/**
 * @param {string} pngPath
 * @returns {{ converted: boolean, before: number, after: number, outName: string }}
 */
function optimizePng(pngPath) {
  const rel = path.relative(UI, pngPath).replace(/\\/g, "/");
  const base = rel.replace(/\.png$/i, "");
  const outPath = path.join(UI, `${base}.webp`);

  if (KEEP_PNG.has(path.basename(pngPath))) {
    console.log(`keep PNG: ${rel}`);
    return { converted: false, before: 0, after: 0, outName: rel };
  }

  const before = fs.statSync(pngPath).size;
  const tmp = `${outPath}.tmp`;
  execFileSync(CWEBP, ["-lossless", pngPath, "-o", tmp], { stdio: "pipe" });
  const after = fs.statSync(tmp).size;

  if (after >= before) {
    fs.unlinkSync(tmp);
    console.log(`keep PNG (WebP larger): ${rel} ${(before / 1024).toFixed(0)} KB`);
    return { converted: false, before, after: before, outName: rel };
  }

  fs.renameSync(tmp, outPath);
  ensureDir(SOURCE);
  const archive = path.join(SOURCE, rel);
  ensureDir(path.dirname(archive));
  if (!fs.existsSync(archive)) {
    fs.renameSync(pngPath, archive);
  } else {
    fs.unlinkSync(pngPath);
  }

  const pct = ((1 - after / before) * 100).toFixed(0);
  console.log(
    `${rel} → ${base}.webp: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${pct}%)`
  );
  return { converted: true, before, after, outName: `${base}.webp` };
}

ensureDir(UI);

let totalBefore = 0;
let totalAfter = 0;
let converted = 0;

console.log("\n=== UI images (lossless WebP when smaller) ===\n");

for (const pngPath of listPngs(UI)) {
  const result = optimizePng(pngPath);
  if (result.converted) {
    converted += 1;
    totalBefore += result.before;
    totalAfter += result.after;
  }
}

if (converted) {
  console.log(
    `\nConverted ${converted} file(s): ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB`
  );
} else {
  console.log("\nNo new conversions (already optimized or WebP not smaller).");
}

console.log("\nDone. Update /ui/*.webp paths in app code if this was a first run.\n");
