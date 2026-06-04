#!/usr/bin/env node
/**
 * Screen panel C textures (~2.3 m × 0.6 m sloped face on control_panel_01).
 *
 *   node scripts/optimize-control-panel-screen-c.mjs
 *
 * Sources: assets/screen_panel_*.png (Cursor attachment) or public/.../screen_c/*.png
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const OUT = path.join(REPO, "public/textures/control_panel/screen_c");
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

/** Albedo full res; data maps slightly smaller. */
/** Full fascia ~2.28 m × 1.65 m → wide aspect like the authored panel. */
const W = 2048;
const H = 896;

const MAPS = [
  { stem: "screen_panel_albedo", out: "screen_c_albedo.webp", w: W, h: H, q: 80 },
  { stem: "screen_panel_normal", out: "screen_c_normal.webp", w: W, h: H, q: 85 },
  { stem: "screen_panel_roughness", out: "screen_c_roughness.webp", w: W, h: H, q: 82 },
  { stem: "screen_panel_metallic", out: "screen_c_metallic.webp", w: W, h: H, q: 82 },
  { stem: "screen_panel_emissive", out: "screen_c_emissive.webp", w: W, h: H, q: 78 },
  { stem: "screen_panel_ao", out: "screen_c_ao.webp", w: W, h: H, q: 82 },
];

console.log("\n=== control panel screen C ===\n");
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
