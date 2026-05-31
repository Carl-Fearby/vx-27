/**
 * Write hand-authored pile defs to level1.json (not procedural stacking).
 *
 *   npm run pile:barrels
 *   npm run pile:barrels:check
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  OIL_BARREL_PILE_ID,
  applyOilBarrelPileToArena,
  checkArenaOilBarrelPile,
} from "../lib/OilBarrelPileLayout.js";
import { preloadOilBarrelAssets } from "../lib/OilBarrel.js";

const LEVEL_PATH = new URL(
  "../public/levels/level1.json",
  import.meta.url
);

function parseArgs(argv) {
  let seed = 7;
  let write = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--write") write = true;
    else if (argv[i] === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
  }
  return { seed, write };
}

const { seed, write } = parseArgs(process.argv);

const level = JSON.parse(readFileSync(LEVEL_PATH, "utf8"));
await preloadOilBarrelAssets(level).catch(() => {});

const result = applyOilBarrelPileToArena(level, { seed });

if (!result.ok) {
  console.error("Failed to place:", result.failed.join(", "));
  process.exit(1);
}

const check = checkArenaOilBarrelPile(level);
if (!check.ok) {
  console.error("Validation failed after generation");
  process.exit(1);
}

console.log(`Pile OK — ${result.props.length} barrels (hand-authored layout)`);
for (const p of result.props) {
  const bits = [
    p.topCap ? "capped" : "open",
    p.layOnSide ? "on-side" : null,
    p.rotationX != null ? `lean ${p.rotationX}` : null,
  ].filter(Boolean);
  console.log(`  ${p.id}: (${p.x}, ${p.z}) ${bits.join(", ")}`);
}

if (write) {
  writeFileSync(LEVEL_PATH, `${JSON.stringify(level, null, 2)}\n`, "utf8");
  console.log(`Wrote ${LEVEL_PATH.pathname}`);
} else {
  console.log("Dry run — pass --write to update level1.json");
}
