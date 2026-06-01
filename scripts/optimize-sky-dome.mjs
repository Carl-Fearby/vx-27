#!/usr/bin/env node
/**
 * Downscale 8K equirect sky JPGs → 4K WebP for runtime (≈90% smaller).
 *
 *   node scripts/optimize-sky-dome.mjs
 *
 * First run moves the large *_8k_seamless.jpg files into public/sky/_source/
 * (gitignored). Re-run anytime after replacing sources there.
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const SKY = path.join(REPO, "public/sky");
const SOURCE = path.join(SKY, "_source");

const SKY_DOME_JOBS = [
  {
    sourceName: "sky_dome_equirectangular_8k_seamless.jpg",
    outName: "sky_dome_equirectangular_4k.webp",
    w: 4096,
    h: 2048,
    q: 82,
  },
  {
    sourceName: "night_sky_dome_equirectangular_8k_seamless.jpg",
    outName: "night_sky_dome_equirectangular_4k.webp",
    w: 4096,
    h: 2048,
    q: 82,
  },
];

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

/** @param {string} publicPath @param {string} sourcePath */
function resolveSource(publicPath, sourcePath) {
  if (fs.existsSync(sourcePath)) return sourcePath;
  if (fs.existsSync(publicPath)) {
    ensureDir(SOURCE);
    fs.renameSync(publicPath, sourcePath);
    console.log(`Archived → _source/${path.basename(sourcePath)}`);
    return sourcePath;
  }
  return null;
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {{ w: number, h: number, q: number }} opts
 */
function toWebp(src, dest, opts) {
  const tmp = `${dest}.tmp`;
  execFileSync(
    CWEBP,
    [
      "-q",
      String(opts.q),
      "-resize",
      String(opts.w),
      String(opts.h),
      src,
      "-o",
      tmp,
    ],
    { stdio: "inherit" }
  );
  fs.renameSync(tmp, dest);
  return { before: fs.statSync(src).size, after: fs.statSync(dest).size };
}

ensureDir(SOURCE);

let totalBefore = 0;
let totalAfter = 0;

console.log("\n=== Sky dome textures (4K WebP) ===\n");

for (const job of SKY_DOME_JOBS) {
  const publicJpg = path.join(SKY, job.sourceName);
  const archiveJpg = path.join(SOURCE, job.sourceName);
  const dest = path.join(SKY, job.outName);

  const src = resolveSource(publicJpg, archiveJpg);
  if (!src) {
    console.warn(`skip (no source): ${job.sourceName}`);
    continue;
  }

  const { before, after } = toWebp(src, dest, job);
  totalBefore += before;
  totalAfter += after;
  const pct = ((1 - after / before) * 100).toFixed(0);
  console.log(
    `${job.outName} (${job.w}×${job.h} q${job.q}): ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${pct}%)\n`
  );

  if (fs.existsSync(publicJpg)) {
    fs.unlinkSync(publicJpg);
    console.log(`  removed shipped ${job.sourceName}`);
  }
}

console.log(
  `Total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB`
);
console.log("\nDone. Hard-refresh the game (sky cache bust updated in SkyDome.js).\n");
