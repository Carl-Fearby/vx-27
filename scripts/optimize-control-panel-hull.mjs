#!/usr/bin/env node
/**
 * Hull faces A,B,E–J,K,L (not screen C / shelf D) — body_panel PBR trim.
 *
 *   npm run textures:control-panel-hull
 *
 * Sources: assets/body_panel_*.png
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const OUT = path.join(REPO, "public/textures/control_panel/hull");
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

const W = 2048;
const H = 1024;

const MAPS = [
  { stem: "body_panel_albedo", out: "hull_albedo.webp", w: W, h: H, q: 80 },
  { stem: "body_panel_normal", out: "hull_normal.webp", w: W, h: H, q: 85 },
  { stem: "body_panel_roughness", out: "hull_roughness.webp", w: W, h: H, q: 82 },
  { stem: "body_panel_metallic", out: "hull_metallic.webp", w: W, h: H, q: 82 },
  { stem: "body_panel_emissive", out: "hull_emissive.webp", w: W, h: H, q: 78 },
  { stem: "body_panel_ao", out: "hull_ao.webp", w: W, h: H, q: 82 },
];

console.log("\n=== control panel hull (A,B,E–J,K,L) ===\n");
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
