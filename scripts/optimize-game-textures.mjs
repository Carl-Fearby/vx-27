#!/usr/bin/env node
/**
 * Compress game textures to WebP (level tiles, decals, pickups, grenade).
 *
 *   node scripts/optimize-game-textures.mjs level
 *   node scripts/optimize-game-textures.mjs bullet_holes
 *   node scripts/optimize-game-textures.mjs vx27
 *   node scripts/optimize-game-textures.mjs grenade
 *   node scripts/optimize-game-textures.mjs all
 *   node scripts/optimize-game-textures.mjs all --prune-png
 *   node scripts/optimize-game-textures.mjs all --prune-png --prune-grenade-unused
 *
 * Reads .png or existing .webp as source. With --prune-png, removes source .png
 * after a successful encode (keeps files not listed in this script).
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const TEX = path.join(REPO, "public/textures");

const LEVEL_MATERIALS = [
  "ground_concrete_asphalt_dirty",
  "wall_poured_concrete_industrial",
  "wall_corrugated_metal_weathered",
  "ground_smooth_concrete_worn",
  "wall_blue_cinderblock_worn",
  "decal_hazard_stripes_worn",
  "floor_metal_grate_rusty",
  "ground_dirt_rubble_urban",
];

const LEVEL_MAPS = [
  { suffix: "_albedo_tileable", w: 512, h: 512, q: 74 },
  { suffix: "_normal_placeholder", w: 512, h: 512, q: 82 },
  { suffix: "_roughness_placeholder", w: 512, h: 512, q: 80 },
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

const prunePng = process.argv.includes("--prune-png");
const pruneGrenadeUnused = process.argv.includes("--prune-grenade-unused");
const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const mode = cliArgs[0] ?? "all";

/** @param {string} dir @param {string} base @param {string} outName */
function resolveSrc(dir, base, outName) {
  const stem = base.replace(/\.(png|webp)$/i, "");
  for (const ext of [".png", ".webp"]) {
    const p = path.join(dir, stem + ext);
    if (fs.existsSync(p)) return p;
  }
  const outStem = outName.replace(/\.webp$/, "");
  for (const ext of [".png", ".webp"]) {
    const p = path.join(dir, outStem + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {{ w: number, h: number, q?: number }} opts
 */
function toWebp(src, dest, opts) {
  const tmp = `${dest}.tmp`;
  const args = [
    "-q",
    String(opts.q ?? 78),
    "-resize",
    String(opts.w),
    String(opts.h),
    src,
    "-o",
    tmp,
  ];
  execFileSync(CWEBP, args, { stdio: "inherit" });
  fs.renameSync(tmp, dest);
  return { before: fs.statSync(src).size, after: fs.statSync(dest).size };
}

/**
 * @param {{ dir: string, base?: string, out: string, w: number, h: number, q?: number }[]} items
 * @param {string} label
 */
function runItems(label, items) {
  console.log(`\n=== ${label} ===\n`);
  let totalBefore = 0;
  let totalAfter = 0;
  for (const item of items) {
    const dir = path.join(TEX, item.dir ?? ".");
    const srcPath = resolveSrc(dir, item.base ?? item.out, item.out);
    const destPath = path.join(dir, item.out);
    if (!srcPath) {
      console.warn(`skip (missing): ${item.out}`);
      continue;
    }
    const { before, after } = toWebp(srcPath, destPath, item);
    totalBefore += before;
    totalAfter += after;
    const pct = before > after ? ((1 - after / before) * 100).toFixed(0) : "0";
    console.log(
      `${item.out} (${item.w}×${item.h} q${item.q ?? 78}): ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${pct}%)\n`
    );
    if (prunePng && srcPath.endsWith(".png") && srcPath !== destPath) {
      fs.unlinkSync(srcPath);
      console.log(`  pruned ${path.basename(srcPath)}`);
    }
  }
  console.log(
    `${label} total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB`
  );
}

function levelItems() {
  const items = [];
  for (const id of LEVEL_MATERIALS) {
    for (const map of LEVEL_MAPS) {
      const base = `${id}${map.suffix}.png`;
      items.push({
        dir: id,
        base,
        out: `${id}${map.suffix}.webp`,
        w: map.w,
        h: map.h,
        q: map.q,
      });
    }
  }
  return items;
}

const BULLET_HOLES = [
  "01",
  "02",
  "03",
  "04",
  "05",
].map((n) => ({
  dir: "bullet_holes",
  base: `${n}_concrete_bullet_hole_alpha.png`,
  out: `${n}_concrete_bullet_hole_alpha.webp`,
  w: 384,
  h: 384,
  q: 72,
}));

const VX27 = [
  { name: "vx27_body_albedo", w: 1024, h: 341, q: 74, srgb: true },
  { name: "vx27_body_normal", w: 1024, h: 341, q: 82 },
  { name: "vx27_body_roughness", w: 1024, h: 341, q: 80 },
  { name: "vx27_body_metallic", w: 1024, h: 341, q: 80 },
  { name: "vx27_body_emissive", w: 1024, h: 341, q: 72, srgb: true },
  { name: "vx27_body_ao", w: 1024, h: 341, q: 78 },
  { name: "vx27_endcap_albedo", w: 512, h: 512, q: 74, srgb: true },
  { name: "vx27_endcap_normal", w: 512, h: 512, q: 82 },
  { name: "vx27_endcap_roughness", w: 512, h: 512, q: 80 },
  { name: "vx27_endcap_metallic", w: 512, h: 512, q: 80 },
  { name: "vx27_endcap_emissive", w: 512, h: 512, q: 72, srgb: true },
  { name: "vx27_endcap_ao", w: 512, h: 512, q: 78 },
].map(({ name, ...opts }) => ({
  dir: "vx27",
  base: `${name}.png`,
  out: `${name}.webp`,
  ...opts,
}));

/** Only maps loaded at runtime by lib/Grenade.js */
const GRENADE_RUNTIME = [
  {
    dir: "grenade",
    base: "grenade_reward_cylinder_body_wrap_albedo.png",
    out: "grenade_reward_cylinder_body_wrap_albedo.webp",
    w: 1024,
    h: 512,
    q: 74,
  },
  {
    dir: "grenade",
    base: "grenade_reward_cylinder_top_cap_albedo.png",
    out: "grenade_reward_cylinder_top_cap_albedo.webp",
    w: 512,
    h: 512,
    q: 74,
  },
  {
    dir: "grenade",
    base: "grenade_reward_cylinder_bottom_cap_albedo.png",
    out: "grenade_reward_cylinder_bottom_cap_albedo.webp",
    w: 512,
    h: 512,
    q: 74,
  },
];

const MODES = ["level", "bullet_holes", "vx27", "grenade", "all"];

if (!MODES.includes(mode)) {
  console.error(`Usage: optimize-game-textures.mjs ${MODES.join("|")} [--prune-png]`);
  process.exit(1);
}

if (mode === "level" || mode === "all") runItems("Level materials", levelItems());
if (mode === "bullet_holes" || mode === "all") runItems("Bullet holes", BULLET_HOLES);
if (mode === "vx27" || mode === "all") runItems("VX27 HP orb", VX27);
if (mode === "grenade" || mode === "all") runItems("Grenade (runtime albedos)", GRENADE_RUNTIME);

function pruneGrenadeUnusedMaps() {
  const dir = path.join(TEX, "grenade");
  const keep = new Set(["grenade_reward_texture_pack_preview.png"]);
  let removed = 0;
  let bytes = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".png") || keep.has(name)) continue;
    const p = path.join(dir, name);
    bytes += fs.statSync(p).size;
    fs.unlinkSync(p);
    removed++;
  }
  if (removed) {
    console.log(
      `\nPruned ${removed} unused grenade PNG(s) (−${(bytes / 1024 / 1024).toFixed(1)} MB). Runtime uses 3 albedo WebPs only.\n`
    );
  }
}

if (pruneGrenadeUnused && (mode === "grenade" || mode === "all")) {
  pruneGrenadeUnusedMaps();
}

console.log("\nDone. Update loaders to .webp paths, then hard-refresh the game.");
