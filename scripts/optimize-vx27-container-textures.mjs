#!/usr/bin/env node
/**
 * Compress VX-27 cargo container PBR maps to WebP sized for ~2.4 m shell props.
 *
 *   node scripts/optimize-vx27-container-textures.mjs
 *   node scripts/optimize-vx27-container-textures.mjs --prune-png
 *   node scripts/optimize-vx27-container-textures.mjs --prune-png --prune-unused
 *
 * Only encodes maps referenced by lib/vx27-container/Vx27Container.js SET_FILES.
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const TEX = path.join(REPO, "public/textures/vx27_container");

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const CWEBP = which("cwebp");
if (!CWEBP) {
  console.error("cwebp not found (brew install webp)");
  process.exit(1);
}

const prunePng = process.argv.includes("--prune-png");
const pruneUnused = process.argv.includes("--prune-unused");

/** 2:1 wall/roof maps — enough texels for metre-scaled UV repeat at engagement range. */
const PANEL_W = 1024;
const PANEL_H = 512;

/** Maps loaded at runtime (lib/vx27-container/Vx27Container.js SET_FILES). */
const RUNTIME = [
  ...["side", "inside_wall", "top_bottom"].flatMap((set) => [
    { set, map: "albedo", w: PANEL_W, h: PANEL_H, q: 74 },
    { set, map: "normal", w: PANEL_W, h: PANEL_H, q: 84 },
    { set, map: "roughness", w: PANEL_W, h: PANEL_H, q: 80 },
    { set, map: "metallic", w: PANEL_W, h: PANEL_H, q: 80 },
    { set, map: "ao", w: PANEL_W, h: PANEL_H, q: 78 },
    { set, map: "emissive_mask", w: PANEL_W, h: PANEL_H, q: 72 },
  ]),
  ...["corner_arc"].flatMap((set) => [
    { set, map: "albedo", w: 512, h: 512, q: 74 },
    { set, map: "normal", w: 512, h: 512, q: 84 },
    { set, map: "roughness", w: 512, h: 512, q: 80 },
    { set, map: "metallic", w: 512, h: 512, q: 80 },
    { set, map: "ao", w: 512, h: 512, q: 78 },
  ]),
  ...["endcap_square"].flatMap((set) => [
    { set, map: "albedo", w: 768, h: 768, q: 74 },
    { set, map: "normal", w: 768, h: 768, q: 84 },
    { set, map: "roughness", w: 768, h: 768, q: 80 },
    { set, map: "metallic", w: 768, h: 768, q: 80 },
    { set, map: "ao", w: 768, h: 768, q: 78 },
    { set, map: "alpha", w: 768, h: 768, q: 82 },
    { set, map: "emissive_mask", w: 768, h: 768, q: 72 },
  ]),
  ...["door"].flatMap((set) => [
    { set, map: "albedo", w: 512, h: 1024, q: 74 },
    { set, map: "normal", w: 512, h: 1024, q: 84 },
    { set, map: "roughness", w: 512, h: 1024, q: 80 },
    { set, map: "metallic", w: 512, h: 1024, q: 80 },
    { set, map: "ao", w: 512, h: 1024, q: 78 },
    { set, map: "alpha", w: 512, h: 1024, q: 82 },
    { set, map: "emissive_mask", w: 512, h: 1024, q: 72 },
  ]),
];

function pngName(set, map) {
  return `vx27_container_${set}_${map}.png`;
}

function webpName(set, map) {
  return `vx27_container_${set}_${map}.webp`;
}

function resolveSrc(set, map) {
  for (const name of [pngName(set, map), webpName(set, map)]) {
    const p = path.join(TEX, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function toWebp(src, dest, opts) {
  const tmp = `${dest}.tmp`;
  execFileSync(
    CWEBP,
    ["-q", String(opts.q), "-resize", String(opts.w), String(opts.h), src, "-o", tmp],
    { stdio: "inherit" }
  );
  fs.renameSync(tmp, dest);
  return { before: fs.statSync(src).size, after: fs.statSync(dest).size };
}

console.log("\n=== VX-27 container (runtime maps) ===\n");
let totalBefore = 0;
let totalAfter = 0;

for (const item of RUNTIME) {
  const srcPath = resolveSrc(item.set, item.map);
  const destPath = path.join(TEX, webpName(item.set, item.map));
  if (!srcPath) {
    console.warn(`skip (missing): ${webpName(item.set, item.map)}`);
    continue;
  }
  const { before, after } = toWebp(srcPath, destPath, item);
  totalBefore += before;
  totalAfter += after;
  const pct = before > after ? ((1 - after / before) * 100).toFixed(0) : "0";
  console.log(
    `${webpName(item.set, item.map)} (${item.w}×${item.h} q${item.q}): ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${pct}%)\n`
  );
  if (prunePng && srcPath.endsWith(".png")) {
    fs.unlinkSync(srcPath);
    console.log(`  pruned ${path.basename(srcPath)}`);
  }
}

console.log(
  `Runtime maps: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB (−${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`
);

if (pruneUnused) {
  const keep = new Set([
    "README.txt",
    "manifest.json",
    ...RUNTIME.map((item) => webpName(item.set, item.map)),
  ]);
  let removed = 0;
  let bytes = 0;
  for (const name of fs.readdirSync(TEX)) {
    if (keep.has(name)) continue;
    if (!/\.(png|webp)$/i.test(name)) continue;
    const p = path.join(TEX, name);
    bytes += fs.statSync(p).size;
    fs.unlinkSync(p);
    removed++;
  }
  if (removed) {
    console.log(
      `\nPruned ${removed} unused texture file(s) (−${(bytes / 1024 / 1024).toFixed(2)} MB).`
    );
  }
}

const folderBytes = fs
  .readdirSync(TEX)
  .filter((n) => /\.(png|webp)$/i.test(n))
  .reduce((sum, n) => sum + fs.statSync(path.join(TEX, n)).size, 0);
console.log(`\nFolder total (png+webp): ${(folderBytes / 1024 / 1024).toFixed(2)} MB`);
console.log("\nDone. Hard-refresh the game after loader paths point at .webp.");
