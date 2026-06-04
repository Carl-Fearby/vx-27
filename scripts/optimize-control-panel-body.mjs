#!/usr/bin/env node
/**
 * Hull body trim sheet (swept walls E–J + end caps K/L) — tiled world-metre UVs.
 *
 *   npm run textures:control-panel-body
 *
 * Sources: assets/body_*.png (Cursor attachment) or public/.../body/*.png
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const OUT = path.join(REPO, "public/textures/control_panel/body");
const ASSETS = path.join(
  process.env.HOME ?? REPO,
  ".cursor/projects/Users-F7905607-Dropbox-Projects-GameEngine2/assets"
);

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const CWEBP = which("cwebp");
if (!CWEBP) {
  console.error("cwebp not found (brew install webp)");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/** @param {string} stem */
function findSrc(stem) {
  const dirs = [OUT, ASSETS];
  let best = null;
  let bestMtime = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith(stem) || !/\.(png|webp)$/i.test(f)) continue;
      const p = path.join(dir, f);
      const m = fs.statSync(p).mtimeMs;
      if (m >= bestMtime) {
        bestMtime = m;
        best = p;
      }
    }
  }
  return best;
}

/** @param {string} src @param {string} dest @param {{ w: number, h: number, q?: number }} opts */
function toWebp(src, dest, opts) {
  const tmp = `${dest}.tmp`;
  execFileSync(
    CWEBP,
    ["-q", String(opts.q ?? 78), "-resize", String(opts.w), String(opts.h), src, "-o", tmp],
    { stdio: "inherit" }
  );
  fs.renameSync(tmp, dest);
  const before = fs.statSync(src).size;
  const after = fs.statSync(dest).size;
  return { before, after };
}

const SIZE = 1024;

const MAPS = [
  { stem: "body_albedo", out: "body_albedo.webp", w: SIZE, h: SIZE, q: 80 },
  { stem: "body_normal", out: "body_normal.webp", w: SIZE, h: SIZE, q: 85 },
  { stem: "body_roughness", out: "body_roughness.webp", w: SIZE, h: SIZE, q: 82 },
  { stem: "body_metallic", out: "body_metallic.webp", w: SIZE, h: SIZE, q: 82 },
  { stem: "body_ao", out: "body_ao.webp", w: SIZE, h: SIZE, q: 82 },
];

console.log("\n=== control panel hull body (trim sheet) ===\n");
let totalBefore = 0;
let totalAfter = 0;
for (const m of MAPS) {
  const src = findSrc(m.stem);
  const dest = path.join(OUT, m.out);
  if (!src) {
    console.warn(`skip (missing): ${m.stem}`);
    continue;
  }
  const { before, after } = toWebp(src, dest, m);
  totalBefore += before;
  totalAfter += after;
  console.log(
    `${m.out}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB\n`
  );
}
console.log(
  `total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB`
);
